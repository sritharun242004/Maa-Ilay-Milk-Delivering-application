import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import {
  createCashfreeOrder,
  verifyAndProcessPayment,
  verifyWebhookSignature,
  handleWebhookNotification,
} from '../services/cashfree';
import { csrfProtection } from '../middleware/csrf';
import { calculateDailyPricePaise, calculateBottleDepositPaise } from '../config/pricing';
import { daysInMonth, calculateFirstPayment, getOrCreateMonthlyPayment, isInGracePeriod, calculateNextMonthPreview } from '../utils/monthlyPaymentUtils';
import { NEXT_MONTH_PREVIEW_DAYS } from '../config/constants';
import { getNowIST } from '../utils/dateUtils';

const router = Router();

/**
 * POST /api/payment/create-order
 * Create a new payment order for wallet top-up (legacy, kept for admin credits)
 */
router.post('/create-order', csrfProtection, async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;

    // Validate amount
    const { amountPaise } = req.body;

    if (!amountPaise || typeof amountPaise !== 'number' || amountPaise < 100) {
      return res.status(400).json({ error: 'Invalid amount. Minimum ₹1 required.' });
    }

    if (amountPaise > 10000000) {
      return res.status(400).json({ error: 'Amount too large. Maximum ₹1,00,000 allowed.' });
    }

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Create payment order
    const result = await createCashfreeOrder({
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      amountPaise,
      purpose: `Wallet Top-up - ₹${(amountPaise / 100).toFixed(2)}`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to create payment order' });
    }

    res.json({
      success: true,
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId,
      amount: amountPaise / 100,
    });
  } catch (error: any) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

/**
 * POST /api/payment/create-monthly-order
 * Create a payment order for monthly subscription payment
 */
router.post('/create-monthly-order', csrfProtection, async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { Subscription: true, Wallet: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!customer.Subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const now = getNowIST();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    // Get or create monthly payment record
    const monthlyPayment = await getOrCreateMonthlyPayment(customerId, year, month);

    // Already paid
    if (monthlyPayment.status === 'PAID') {
      return res.json({
        success: true,
        alreadyCovered: true,
        message: 'Monthly payment already completed',
        monthlyPayment: {
          status: monthlyPayment.status,
          totalCostPaise: monthlyPayment.totalCostPaise,
          amountDuePaise: 0,
          paidAt: monthlyPayment.paidAt,
        },
      });
    }

    // Calculate current amount due (wallet may have changed since record creation)
    const walletBalance = customer.Wallet?.balancePaise ?? 0;
    const amountDue = Math.max(0, monthlyPayment.totalCostPaise - walletBalance);

    if (amountDue <= 0) {
      // Wallet covers the full month — mark as paid
      await prisma.monthlyPayment.update({
        where: { id: monthlyPayment.id },
        data: {
          status: 'PAID',
          amountDuePaise: 0,
          amountPaidPaise: monthlyPayment.totalCostPaise,
          paidAt: new Date(),
        },
      });

      return res.json({
        success: true,
        alreadyCovered: true,
        message: 'Month covered by wallet balance',
        monthlyPayment: {
          status: 'PAID',
          totalCostPaise: monthlyPayment.totalCostPaise,
          amountDuePaise: 0,
        },
      });
    }

    // Need Cashfree payment for the remaining amount
    const result = await createCashfreeOrder({
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      amountPaise: amountDue,
      purpose: `Monthly Subscription - ${getMonthName(month)} ${year}`,
      monthlyPaymentId: monthlyPayment.id,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to create payment order' });
    }

    // Link the payment order to the monthly payment
    await prisma.monthlyPayment.update({
      where: { id: monthlyPayment.id },
      data: { paymentOrderId: result.orderId },
    });

    res.json({
      success: true,
      alreadyCovered: false,
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId,
      amountDuePaise: amountDue,
      amount: amountDue / 100,
      monthlyPayment: {
        status: monthlyPayment.status,
        totalCostPaise: monthlyPayment.totalCostPaise,
        amountDuePaise: amountDue,
      },
    });
  } catch (error: any) {
    console.error('Create monthly payment order error:', error);
    res.status(500).json({ error: 'Failed to create monthly payment order' });
  }
});

/**
 * POST /api/payment/create-first-payment
 * Create payment order for first-time subscription (partial month + deposit)
 */
router.post('/create-first-payment', csrfProtection, async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;
    const { dailyQuantityMl } = req.body;

    if (!dailyQuantityMl || ![500, 1000, 1500, 2000, 2500].includes(dailyQuantityMl)) {
      return res.status(400).json({ error: 'Invalid quantity. Must be 500, 1000, 1500, 2000, or 2500 ml.' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, email: true, phone: true, status: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Must be VISITOR (not already subscribed)
    if (customer.status !== 'VISITOR') {
      return res.status(400).json({ error: 'Already subscribed. Use monthly payment instead.' });
    }

    const payment = await calculateFirstPayment(dailyQuantityMl);

    if (payment.totalPaise <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Create Cashfree order
    const result = await createCashfreeOrder({
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      amountPaise: payment.totalPaise,
      purpose: `First Subscription - ${dailyQuantityMl}ml (${payment.remainingDays} days + deposit)`,
      isFirstPayment: true,
      dailyQuantityMl,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to create payment order' });
    }

    res.json({
      success: true,
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId,
      amount: payment.totalPaise / 100,
      breakdown: {
        remainingDays: payment.remainingDays,
        milkCostRs: payment.milkCostPaise / 100,
        depositRs: payment.depositPaise / 100,
        totalRs: payment.totalPaise / 100,
        startDate: payment.startDate.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('Create first payment order error:', error);
    res.status(500).json({ error: 'Failed to create first payment order' });
  }
});

/**
 * GET /api/payment/first-payment-preview
 * Preview the first-time subscription cost without creating an order
 */
router.get('/first-payment-preview', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const dailyQuantityMl = Number(req.query.dailyQuantityMl);
    if (!dailyQuantityMl || ![500, 1000, 1500, 2000, 2500].includes(dailyQuantityMl)) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const payment = await calculateFirstPayment(dailyQuantityMl);
    const dailyRatePaise = await calculateDailyPricePaise(dailyQuantityMl);

    res.json({
      dailyRateRs: dailyRatePaise / 100,
      remainingDays: payment.remainingDays,
      milkCostRs: payment.milkCostPaise / 100,
      depositRs: payment.depositPaise / 100,
      totalRs: payment.totalPaise / 100,
      startDate: payment.startDate.toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('First payment preview error:', error);
    res.status(500).json({ error: 'Failed to calculate first payment' });
  }
});

/**
 * POST /api/payment/create-advance-order
 * Create a payment order for advance payment (wallet credit for next month)
 */
router.post('/create-advance-order', csrfProtection, async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { Subscription: true, Wallet: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!customer.Subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Check current month is paid (block if OVERDUE)
    const now = getNowIST();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentMonthPayment = await prisma.monthlyPayment.findUnique({
      where: { customerId_year_month: { customerId, year: currentYear, month: currentMonth } },
    });

    if (currentMonthPayment && currentMonthPayment.status === 'OVERDUE') {
      return res.status(400).json({
        error: 'Current month payment is overdue. Please pay for this month first.',
        code: 'CURRENT_MONTH_OVERDUE',
      });
    }

    // Validate we're in the preview window
    const totalDaysInMonth = daysInMonth(currentYear, currentMonth);
    const currentDay = now.getDate();
    if (currentDay <= totalDaysInMonth - NEXT_MONTH_PREVIEW_DAYS) {
      return res.status(400).json({ error: 'Advance payment is only available in the last 3 days of the month.' });
    }

    // Calculate shortfall
    const preview = await calculateNextMonthPreview(customerId);

    if (!preview.isPreviewAvailable || !preview.shortfallPaise) {
      return res.json({
        success: true,
        alreadyCovered: true,
        message: 'Your wallet already covers next month.',
      });
    }

    if (preview.shortfallPaise <= 0) {
      return res.json({
        success: true,
        alreadyCovered: true,
        message: 'Your wallet already covers next month.',
      });
    }

    // Create Cashfree order for the shortfall (wallet credit, no MonthlyPayment record)
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const result = await createCashfreeOrder({
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      amountPaise: preview.shortfallPaise,
      purpose: `Advance payment for ${getMonthName(nextMonth)} ${nextYear}`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to create payment order' });
    }

    res.json({
      success: true,
      alreadyCovered: false,
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId,
      amountPaise: preview.shortfallPaise,
      amount: preview.shortfallPaise / 100,
      nextMonthName: getMonthName(nextMonth),
      nextYear,
    });
  } catch (error: any) {
    console.error('Create advance payment order error:', error);
    res.status(500).json({ error: 'Failed to create advance payment order' });
  }
});

/**
 * POST /api/payment/verify
 * Verify payment after user completes payment on Cashfree
 */
router.post('/verify', csrfProtection, async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Verify the payment order belongs to this customer
    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { gatewayOrderId: orderId },
    });

    if (!paymentOrder) {
      return res.status(404).json({ error: 'Payment order not found' });
    }

    if (paymentOrder.customerId !== customerId) {
      return res.status(403).json({ error: 'Unauthorized access to payment order' });
    }

    // Verify and process payment
    const result = await verifyAndProcessPayment({ orderId });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: result.error || 'Payment verification failed',
      });
    }

    // Get updated wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { customerId },
      select: { balancePaise: true },
    });

    // Determine payment type from purpose
    const isFirstPayment = paymentOrder.purpose.startsWith('First Subscription');
    const isMonthlyPayment = paymentOrder.purpose.startsWith('Monthly Subscription');
    const isAdvancePayment = paymentOrder.purpose.startsWith('Advance payment');

    res.json({
      success: true,
      verified: result.verified,
      amount: result.amountPaise ? result.amountPaise / 100 : 0,
      walletBalance: wallet ? wallet.balancePaise / 100 : 0,
      paymentType: isFirstPayment ? 'first_subscription' : isMonthlyPayment ? 'monthly' : isAdvancePayment ? 'advance_monthly' : 'topup',
    });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * POST /api/payment/webhook
 * Webhook endpoint for Cashfree to send payment notifications
 * This endpoint should NOT have CSRF protection as it's called by Cashfree servers
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Get webhook signature from headers
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const signature = req.headers['x-webhook-signature'] as string;

    if (!timestamp || !signature) {
      console.error('Missing webhook headers');
      return res.status(400).json({ error: 'Missing webhook signature headers' });
    }

    // Verify webhook signature
    const rawBody = JSON.stringify(req.body);
    const isValid = verifyWebhookSignature(timestamp, rawBody, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook
    await handleWebhookNotification(req.body);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * GET /api/payment/status/:orderId
 * Get payment order status
 */
router.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;
    const { orderId } = req.params;

    // Get payment order
    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { gatewayOrderId: orderId },
    });

    if (!paymentOrder) {
      return res.status(404).json({ error: 'Payment order not found' });
    }

    if (paymentOrder.customerId !== customerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      orderId: paymentOrder.gatewayOrderId,
      status: paymentOrder.status,
      amount: paymentOrder.amountPaise / 100,
      createdAt: paymentOrder.createdAt,
      completedAt: paymentOrder.completedAt,
    });
  } catch (error: any) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

/**
 * GET /api/payment/history
 * Get customer's payment history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const customerId = user.id;

    // Get payment orders
    const paymentOrders = await prisma.paymentOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 transactions
    });

    const formattedOrders = paymentOrders.map((order) => ({
      orderId: order.gatewayOrderId,
      amount: order.amountPaise / 100,
      status: order.status,
      purpose: order.purpose,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
    }));

    res.json({ payments: formattedOrders });
  } catch (error: any) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

function getMonthName(month: number): string {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month] || '';
}

export default router;

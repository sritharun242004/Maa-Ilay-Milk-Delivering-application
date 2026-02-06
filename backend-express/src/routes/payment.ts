import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  createCashfreeOrder,
  verifyAndProcessPayment,
  verifyWebhookSignature,
  handleWebhookNotification,
} from '../services/cashfree';
import { csrfProtection } from '../middleware/csrf';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/payment/create-order
 * Create a new payment order for wallet top-up
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

    res.json({
      success: true,
      verified: result.verified,
      amount: result.amountPaise ? result.amountPaise / 100 : 0,
      walletBalance: wallet ? wallet.balancePaise / 100 : 0,
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

export default router;

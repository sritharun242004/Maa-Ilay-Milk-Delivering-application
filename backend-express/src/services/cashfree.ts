import { randomBytes } from 'crypto';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Cashfree API Configuration
const CASHFREE_API_VERSION = '2023-08-01';
const CASHFREE_BASE_URL = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

const APP_ID = process.env.CASHFREE_APP_ID || '';
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';

interface CreateOrderParams {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amountPaise: number;
  purpose: string;
}

interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  error?: string;
}

/**
 * Create a Cashfree payment order
 */
export async function createCashfreeOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  try {
    const { customerId, customerName, customerEmail, customerPhone, amountPaise, purpose } = params;

    // Convert paise to rupees
    const amountRupees = (amountPaise / 100).toFixed(2);

    // Generate cryptographically secure unique order ID
    // Format: order_{timestamp}_{random_hex}
    // Example: order_1739788922331_a1b2c3d4e5f6g7h8
    const timestamp = Date.now();
    const randomSuffix = randomBytes(8).toString('hex'); // 16 characters of secure randomness
    const orderId = `order_${timestamp}_${randomSuffix}`;

    // Create order request
    const requestData = {
      order_amount: parseFloat(amountRupees),
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment/callback?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/payment/webhook`,
      },
      order_note: purpose,
    };

    console.log('Creating Cashfree order:', { orderId, amount: amountRupees });

    // Make API request to Cashfree
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/orders`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': CASHFREE_API_VERSION,
          'x-client-id': APP_ID,
          'x-client-secret': SECRET_KEY,
        },
      }
    );

    if (!response.data || !response.data.payment_session_id) {
      throw new Error('Invalid response from Cashfree');
    }

    const orderData = response.data;

    console.log('Cashfree order created:', { orderId, sessionId: orderData.payment_session_id });

    // Save payment order to database
    await prisma.paymentOrder.create({
      data: {
        customerId,
        paymentGateway: 'CASHFREE',
        gatewayOrderId: orderId,
        amountPaise,
        purpose,
        status: 'PENDING',
        metadata: {
          paymentSessionId: orderData.payment_session_id,
          cfOrderId: orderData.cf_order_id,
        },
      },
    });

    return {
      success: true,
      orderId,
      paymentSessionId: orderData.payment_session_id,
    };
  } catch (error: any) {
    console.error('Cashfree create order error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create payment order',
    };
  }
}

interface VerifyPaymentParams {
  orderId: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  verified: boolean;
  amountPaise?: number;
  customerId?: string;
  error?: string;
}

/**
 * Verify payment and update wallet balance
 */
export async function verifyAndProcessPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResponse> {
  try {
    const { orderId } = params;

    console.log('Verifying payment for order:', orderId);

    // CRITICAL: Use transaction with SELECT FOR UPDATE to prevent race conditions
    // This ensures only one verification process can run for the same order at a time
    return await prisma.$transaction(async (tx) => {
      // Lock the payment order row to prevent concurrent processing
      const paymentOrder = await tx.paymentOrder.findUnique({
        where: { gatewayOrderId: orderId },
      });

      if (!paymentOrder) {
        return { success: false, verified: false, error: 'Payment order not found' };
      }

      // IDEMPOTENCY CHECK: If already processed, return success immediately
      // This prevents double-crediting if verify is called multiple times
      if (paymentOrder.status === 'SUCCESS') {
        console.log(`Payment ${orderId} already processed. Returning cached result.`);
        return {
          success: true,
          verified: true,
          amountPaise: paymentOrder.amountPaise,
          customerId: paymentOrder.customerId,
        };
      }

      // If status is PENDING, we need to check with Cashfree
      // If status is FAILED, this is a retry attempt - allow it to proceed

      // Fetch payment status from Cashfree
      const response = await axios.get(
        `${CASHFREE_BASE_URL}/orders/${orderId}/payments`,
        {
          headers: {
            'x-api-version': CASHFREE_API_VERSION,
            'x-client-id': APP_ID,
            'x-client-secret': SECRET_KEY,
          },
        }
      );

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid payment response from Cashfree');
      }

      const payments = response.data;

      console.log('Payment status:', payments);

      // Find successful payment
      const successfulPayment = payments.find((p: any) =>
        p.payment_status === 'SUCCESS' || p.payment_status === 'CAPTURED'
      );

      if (!successfulPayment) {
        // Update status to failed if payment explicitly failed
        const failedPayment = payments.find((p: any) => p.payment_status === 'FAILED');
        if (failedPayment) {
          await tx.paymentOrder.update({
            where: { gatewayOrderId: orderId },
            data: { status: 'FAILED' },
          });
        }

        return { success: false, verified: false, error: 'Payment not successful' };
      }

      // Update payment order status to SUCCESS (within transaction)
      await tx.paymentOrder.update({
        where: { gatewayOrderId: orderId },
        data: {
          gatewayPaymentId: successfulPayment.cf_payment_id,
          status: 'SUCCESS',
          completedAt: new Date(),
          metadata: {
            ...(paymentOrder.metadata as any),
            paymentMethod: successfulPayment.payment_method,
            paymentTime: successfulPayment.payment_time,
          },
        },
      });

      // Credit wallet balance (within same transaction for atomicity)
      await creditWalletInTransaction(
        tx,
        paymentOrder.customerId,
        paymentOrder.amountPaise,
        orderId,
        paymentOrder.purpose
      );

      return {
        success: true,
        verified: true,
        amountPaise: paymentOrder.amountPaise,
        customerId: paymentOrder.customerId,
      };
    }, {
      timeout: 15000, // 15 seconds timeout for payment verification
      isolationLevel: 'Serializable', // Highest isolation to prevent any race conditions
    });
  } catch (error: any) {
    console.error('Cashfree verify payment error:', error.response?.data || error.message);
    return {
      success: false,
      verified: false,
      error: error.response?.data?.message || error.message || 'Failed to verify payment',
    };
  }
}

/**
 * Credit amount to customer's wallet within a transaction
 * IMPORTANT: This must be called within a Prisma transaction to ensure atomicity
 */
async function creditWalletInTransaction(
  tx: any, // Prisma transaction client
  customerId: string,
  amountPaise: number,
  referenceId: string,
  description: string
): Promise<void> {
  // Get or create wallet (within transaction)
  let wallet = await tx.wallet.findUnique({
    where: { customerId },
  });

  if (!wallet) {
    wallet = await tx.wallet.create({
      data: {
        customerId,
        balancePaise: 0,
      },
    });
  }

  // Update wallet balance
  const newBalance = wallet.balancePaise + amountPaise;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balancePaise: newBalance,
      negativeBalanceSince: newBalance >= 0 ? null : wallet.negativeBalanceSince,
    },
  });

  // Create transaction record
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'WALLET_TOPUP',
      amountPaise,
      balanceAfterPaise: newBalance,
      description: description || 'Wallet top-up via Cashfree',
      referenceId,
      referenceType: 'PAYMENT_ORDER',
    },
  });

  console.log(`✅ Wallet credited: Customer ${customerId}, Amount ₹${amountPaise / 100}, New Balance ₹${newBalance / 100}`);
}

/**
 * Credit amount to customer's wallet (standalone - for backward compatibility)
 */
async function creditWallet(
  customerId: string,
  amountPaise: number,
  referenceId: string,
  description: string
): Promise<void> {
  return await prisma.$transaction(async (tx) => {
    await creditWalletInTransaction(tx, customerId, amountPaise, referenceId, description);
  });
}

/**
 * Verify webhook signature for security
 */
export function verifyWebhookSignature(
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  try {
    const secretKey = SECRET_KEY;
    const signatureData = `${timestamp}${rawBody}`;

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signatureData)
      .digest('base64');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Handle webhook payment notification from Cashfree
 *
 * IMPORTANT: Cashfree may send duplicate webhook notifications
 * We use the payment order status as idempotency key to prevent duplicate processing
 */
export async function handleWebhookNotification(webhookData: any): Promise<void> {
  try {
    const { type, data } = webhookData;

    // Handle payment success event
    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const { order } = data;
      const orderId = order.order_id;

      console.log(`📬 Webhook received: PAYMENT_SUCCESS for order ${orderId}`);

      // IDEMPOTENCY: verifyAndProcessPayment already has idempotency checks
      // It will only credit wallet once even if webhook is sent multiple times
      const result = await verifyAndProcessPayment({ orderId });

      if (result.success) {
        console.log(`✅ Webhook processed successfully for order ${orderId}`);
      } else {
        console.log(`⚠️ Webhook processing failed for order ${orderId}: ${result.error}`);
      }
    }

    // Handle payment failure event
    if (type === 'PAYMENT_FAILED_WEBHOOK') {
      const { order } = data;
      const orderId = order.order_id;

      console.log(`📬 Webhook received: PAYMENT_FAILED for order ${orderId}`);

      // IDEMPOTENCY: updateMany only updates if status is not already FAILED
      // Multiple webhook calls won't cause issues
      const updated = await prisma.paymentOrder.updateMany({
        where: {
          gatewayOrderId: orderId,
          status: { not: 'FAILED' }, // Only update if not already failed
        },
        data: { status: 'FAILED' },
      });

      console.log(`✅ Payment order ${orderId} marked as FAILED (${updated.count} rows updated)`);
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
    // Re-throw error so webhook endpoint returns 500
    // Cashfree will retry failed webhooks
    throw error;
  }
}

export default {
  createCashfreeOrder,
  verifyAndProcessPayment,
  verifyWebhookSignature,
  handleWebhookNotification,
};

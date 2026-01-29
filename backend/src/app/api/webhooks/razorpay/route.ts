import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyWebhookSignature } from "@/lib/razorpay"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-razorpay-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature)
    
    if (!isValid) {
      console.error("Invalid Razorpay webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event

    console.log("Razorpay webhook event:", eventType)

    switch (eventType) {
      case "payment.captured":
        // Payment successful - usually already handled by verify endpoint
        // This is a backup to ensure payment is processed
        await handlePaymentCaptured(event.payload.payment.entity)
        break

      case "payment.failed":
        // Payment failed
        await handlePaymentFailed(event.payload.payment.entity)
        break

      case "refund.created":
        // Refund initiated
        await handleRefundCreated(event.payload.refund.entity)
        break

      default:
        console.log("Unhandled webhook event:", eventType)
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error("Webhook error:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handlePaymentCaptured(payment: any) {
  const orderId = payment.order_id

  // Check if already processed (idempotency)
  const paymentOrder = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: orderId }
  })

  if (!paymentOrder) {
    console.log("Payment order not found for order:", orderId)
    return
  }

  if (paymentOrder.status === "SUCCESS") {
    console.log("Payment already processed:", orderId)
    return
  }

  // Mark as success if still pending
  // Note: Full processing should be done via verify endpoint
  // This is just a safety net
  await prisma.paymentOrder.update({
    where: { id: paymentOrder.id },
    data: {
      status: "SUCCESS",
      razorpayPaymentId: payment.id,
      completedAt: new Date()
    }
  })

  console.log("Payment marked as success via webhook:", orderId)
}

async function handlePaymentFailed(payment: any) {
  const orderId = payment.order_id

  const paymentOrder = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: orderId }
  })

  if (!paymentOrder) {
    return
  }

  await prisma.paymentOrder.update({
    where: { id: paymentOrder.id },
    data: {
      status: "FAILED",
      razorpayPaymentId: payment.id
    }
  })

  console.log("Payment marked as failed:", orderId)
}

async function handleRefundCreated(refund: any) {
  const paymentId = refund.payment_id

  const paymentOrder = await prisma.paymentOrder.findFirst({
    where: { razorpayPaymentId: paymentId }
  })

  if (!paymentOrder) {
    return
  }

  // Update status
  await prisma.paymentOrder.update({
    where: { id: paymentOrder.id },
    data: { status: "REFUNDED" }
  })

  // Get customer wallet and create refund transaction
  const customer = await prisma.customer.findUnique({
    where: { id: paymentOrder.customerId },
    include: { wallet: true }
  })

  if (customer?.wallet) {
    const newBalance = customer.wallet.balancePaise - refund.amount

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: customer.wallet.id },
        data: { balancePaise: newBalance }
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: customer.wallet.id,
          type: "REFUND",
          amountPaise: -refund.amount,
          balanceAfterPaise: newBalance,
          description: `Refund processed: ${refund.id}`,
          referenceId: refund.id,
          referenceType: "razorpay_refund"
        }
      })
    ])
  }

  console.log("Refund processed:", refund.id)
}

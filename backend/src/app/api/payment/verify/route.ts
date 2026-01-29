import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { verifyPaymentSignature } from "@/lib/razorpay"
import { successResponse, errorResponse, requireCustomer } from "@/lib/api-utils"
import { 
  calculateMonthlyTotal, 
  calculateBottleComposition,
  DEPOSIT_LARGE_BOTTLE_PAISE,
  DEPOSIT_SMALL_BOTTLE_PAISE
} from "@/lib/constants"
import { getDaysInMonth, getISTDate, getCurrentMonthYear } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const body = await request.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return errorResponse("Missing payment details", 400)
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    )

    if (!isValid) {
      return errorResponse("Invalid payment signature", 400)
    }

    // Get payment order
    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { razorpayOrderId: razorpay_order_id }
    })

    if (!paymentOrder) {
      return errorResponse("Payment order not found", 404)
    }

    // Check if already processed (idempotency)
    if (paymentOrder.status === "SUCCESS") {
      return successResponse({ message: "Payment already processed" })
    }

    // Get customer with all relations
    const customer = await prisma.customer.findUnique({
      where: { id: paymentOrder.customerId },
      include: {
        subscription: true,
        wallet: true
      }
    })

    if (!customer || !customer.wallet) {
      return errorResponse("Customer or wallet not found", 404)
    }

    // Process payment based on purpose
    const now = getISTDate()
    
    if (paymentOrder.purpose === "subscription_start") {
      // First subscription payment
      if (!customer.subscription) {
        return errorResponse("Subscription not found", 400)
      }

      const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1)
      const { milkTotal, depositTotal } = calculateMonthlyTotal(
        customer.subscription.dailyQuantityMl,
        daysInMonth,
        true
      )

      // Update everything in a transaction
      await prisma.$transaction(async (tx) => {
        // Update payment order
        await tx.paymentOrder.update({
          where: { id: paymentOrder.id },
          data: {
            status: "SUCCESS",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            completedAt: new Date()
          }
        })

        // Add to wallet
        const newBalance = customer.wallet!.balancePaise + paymentOrder.amountPaise
        await tx.wallet.update({
          where: { id: customer.wallet!.id },
          data: { balancePaise: newBalance }
        })

        // Create wallet transaction for top-up
        await tx.walletTransaction.create({
          data: {
            walletId: customer.wallet!.id,
            type: "WALLET_TOPUP",
            amountPaise: paymentOrder.amountPaise,
            balanceAfterPaise: newBalance,
            description: "Subscription start payment",
            referenceId: razorpay_payment_id,
            referenceType: "razorpay"
          }
        })

        // Deduct deposit from wallet
        const balanceAfterDeposit = newBalance - depositTotal
        await tx.wallet.update({
          where: { id: customer.wallet!.id },
          data: { balancePaise: balanceAfterDeposit }
        })

        // Create wallet transaction for deposit
        await tx.walletTransaction.create({
          data: {
            walletId: customer.wallet!.id,
            type: "DEPOSIT_CHARGE",
            amountPaise: -depositTotal,
            balanceAfterPaise: balanceAfterDeposit,
            description: "Initial bottle deposit (Month 1)",
            referenceId: paymentOrder.id,
            referenceType: "subscription"
          }
        })

        // Update customer status to ACTIVE
        await tx.customer.update({
          where: { id: customer.id },
          data: { status: "ACTIVE" }
        })

        // Update subscription
        await tx.subscription.update({
          where: { id: customer.subscription!.id },
          data: {
            status: "ACTIVE",
            startDate: now,
            currentCycleStart: now,
            paymentCycleCount: 1,
            pauseMonthYear: getCurrentMonthYear(),
            pauseDaysUsedThisMonth: 0
          }
        })

        // Create initial bottle ledger entries
        const { largeBottles, smallBottles } = calculateBottleComposition(
          customer.subscription!.dailyQuantityMl
        )

        // Initialize bottle balance (bottles will be issued on first delivery)
        await tx.bottleLedger.create({
          data: {
            customerId: customer.id,
            action: "ADJUSTMENT",
            size: "LARGE",
            quantity: 0,
            largeBottleBalanceAfter: 0,
            smallBottleBalanceAfter: 0,
            description: "Initial balance - subscription started"
          }
        })
      })

      return successResponse({ 
        message: "Subscription activated successfully!",
        status: "ACTIVE"
      })

    } else {
      // Regular wallet top-up
      await prisma.$transaction(async (tx) => {
        // Update payment order
        await tx.paymentOrder.update({
          where: { id: paymentOrder.id },
          data: {
            status: "SUCCESS",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            completedAt: new Date()
          }
        })

        // Update wallet balance
        const newBalance = customer.wallet!.balancePaise + paymentOrder.amountPaise
        await tx.wallet.update({
          where: { id: customer.wallet!.id },
          data: {
            balancePaise: newBalance,
            // Clear negative balance tracking if now positive
            negativeBalanceSince: newBalance >= 0 ? null : customer.wallet!.negativeBalanceSince
          }
        })

        // Create wallet transaction
        await tx.walletTransaction.create({
          data: {
            walletId: customer.wallet!.id,
            type: "WALLET_TOPUP",
            amountPaise: paymentOrder.amountPaise,
            balanceAfterPaise: newBalance,
            description: "Wallet top-up via Razorpay",
            referenceId: razorpay_payment_id,
            referenceType: "razorpay"
          }
        })

        // If customer was blocked due to low balance, check if they can be unblocked
        if (customer.status === "BLOCKED" && newBalance >= 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { status: "ACTIVE" }
          })
        }
      })

      return successResponse({ 
        message: "Wallet topped up successfully!",
        newBalance: customer.wallet!.balancePaise + paymentOrder.amountPaise
      })
    }

  } catch (err) {
    console.error("Verify payment error:", err)
    return errorResponse("Payment verification failed", 500)
  }
}

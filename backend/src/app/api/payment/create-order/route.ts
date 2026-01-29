import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { createRazorpayOrder } from "@/lib/razorpay"
import { successResponse, errorResponse, validationError, requireCustomer } from "@/lib/api-utils"
import { walletTopupSchema } from "@/lib/validations"
import { 
  calculateMonthlyTotal, 
  isDepositDue,
  formatPaise 
} from "@/lib/constants"
import { getDaysInMonth, getISTDate } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const body = await request.json()
    const { purpose } = body // "wallet_topup" or "subscription_start"

    const customer = await prisma.customer.findUnique({
      where: { email: session!.user.email! },
      include: {
        subscription: true,
        wallet: true
      }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    let amountPaise: number
    let description: string

    if (purpose === "subscription_start") {
      // First subscription payment - full month + deposit
      if (!customer.subscription) {
        return errorResponse("Please select your subscription quantity first", 400)
      }

      if (customer.status !== "PENDING_PAYMENT") {
        return errorResponse("Your account is not ready for payment", 400)
      }

      const now = getISTDate()
      const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1)
      
      // Calculate first month total (always includes deposit for month 1)
      const { milkTotal, depositTotal, grandTotal } = calculateMonthlyTotal(
        customer.subscription.dailyQuantityMl,
        daysInMonth,
        true // First month always has deposit
      )

      amountPaise = grandTotal
      description = `Subscription Start: ${formatPaise(milkTotal)} (milk) + ${formatPaise(depositTotal)} (deposit)`

    } else {
      // Regular wallet top-up
      const result = walletTopupSchema.safeParse(body)
      if (!result.success) {
        return validationError(result.error)
      }
      
      amountPaise = result.data.amountPaise
      description = "Wallet Top-up"
    }

    // Create Razorpay order
    const receipt = `maa_${customer.id.slice(-8)}_${Date.now()}`
    
    const razorpayOrder = await createRazorpayOrder(
      amountPaise,
      receipt,
      {
        customerId: customer.id,
        purpose,
        customerEmail: customer.email
      }
    )

    // Save payment order to database
    const paymentOrder = await prisma.paymentOrder.create({
      data: {
        customerId: customer.id,
        razorpayOrderId: razorpayOrder.id,
        amountPaise,
        purpose,
        status: "PENDING"
      }
    })

    return successResponse({
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      description,
      paymentOrderId: paymentOrder.id
    })

  } catch (err) {
    console.error("Create order error:", err)
    return errorResponse("Failed to create payment order", 500)
  }
}

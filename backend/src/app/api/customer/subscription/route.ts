import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireCustomer } from "@/lib/api-utils"
import { subscriptionSchema } from "@/lib/validations"
import { 
  calculateBottleComposition, 
  calculateDailyPrice,
  calculateMonthlyTotal,
  isDepositDue
} from "@/lib/constants"
import { getDaysInMonth, getISTDate } from "@/lib/utils"

// Get subscription details
export async function GET() {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

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

    if (!customer.subscription) {
      return successResponse({ subscription: null })
    }

    // Calculate next payment details
    const nextCycle = customer.subscription.paymentCycleCount + 1
    const depositDue = isDepositDue(nextCycle)
    const now = getISTDate()
    const daysInNextMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 2)
    
    const nextPayment = calculateMonthlyTotal(
      customer.subscription.dailyQuantityMl,
      daysInNextMonth,
      depositDue
    )

    return successResponse({
      subscription: customer.subscription,
      wallet: customer.wallet,
      nextPayment: {
        cycleNumber: nextCycle,
        depositDue,
        ...nextPayment
      }
    })

  } catch (err) {
    console.error("Get subscription error:", err)
    return errorResponse("Failed to fetch subscription", 500)
  }
}

// Create or update subscription quantity
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const body = await request.json()
    
    const result = subscriptionSchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { dailyQuantityMl } = result.data

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

    // Check if customer is approved
    if (customer.status !== "PENDING_PAYMENT" && customer.status !== "ACTIVE") {
      return errorResponse("Your account is not approved yet", 400)
    }

    const { largeBottles, smallBottles } = calculateBottleComposition(dailyQuantityMl)
    const dailyPricePaise = calculateDailyPrice(dailyQuantityMl)

    if (customer.subscription) {
      // Update existing subscription
      const subscription = await prisma.subscription.update({
        where: { customerId: customer.id },
        data: {
          dailyQuantityMl,
          dailyPricePaise,
          largeBotles: largeBottles,
          smallBottles
        }
      })

      return successResponse({ 
        subscription,
        message: "Subscription quantity updated successfully"
      })
    }

    // Create new subscription
    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        dailyQuantityMl,
        dailyPricePaise,
        largeBotles: largeBottles,
        smallBottles,
        status: "PENDING",
        paymentCycleCount: 0
      }
    })

    return successResponse({ 
      subscription,
      message: "Subscription created. Please complete payment to activate."
    }, 201)

  } catch (err) {
    console.error("Subscription error:", err)
    return errorResponse("Failed to update subscription", 500)
  }
}

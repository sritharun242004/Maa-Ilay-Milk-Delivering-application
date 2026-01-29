import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyCronSecret } from "@/lib/api-utils"
import { 
  isDepositDue, 
  calculateDepositAmount 
} from "@/lib/constants"
import { getISTDate, getCurrentMonthYear } from "@/lib/utils"

// This cron job runs on the 1st of every month at 12:01 AM IST
// It increments subscription cycles and charges deposits when due
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const today = getISTDate()
    const currentMonthYear = getCurrentMonthYear()

    console.log("Processing monthly cycle for:", currentMonthYear)

    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        customer: {
          include: {
            wallet: true
          }
        }
      }
    })

    const results = {
      cyclesIncremented: 0,
      depositsCharged: 0,
      totalDepositAmount: 0,
      pauseDaysReset: 0,
      errors: [] as string[]
    }

    for (const subscription of activeSubscriptions) {
      try {
        if (!subscription.customer.wallet) {
          continue
        }

        const newCycleCount = subscription.paymentCycleCount + 1
        const depositDue = isDepositDue(newCycleCount)

        // Update subscription cycle
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            paymentCycleCount: newCycleCount,
            currentCycleStart: today,
            // Reset pause days for new month
            pauseDaysUsedThisMonth: 0,
            pauseMonthYear: currentMonthYear
          }
        })

        results.cyclesIncremented++
        results.pauseDaysReset++

        // Charge deposit if due (every 3 months)
        if (depositDue) {
          const depositAmount = calculateDepositAmount(subscription.dailyQuantityMl)
          const currentBalance = subscription.customer.wallet.balancePaise
          const newBalance = currentBalance - depositAmount

          await prisma.$transaction([
            // Deduct from wallet
            prisma.wallet.update({
              where: { id: subscription.customer.wallet!.id },
              data: {
                balancePaise: newBalance,
                negativeBalanceSince: newBalance < 0 
                  ? (subscription.customer.wallet!.negativeBalanceSince || today)
                  : null
              }
            }),

            // Create wallet transaction
            prisma.walletTransaction.create({
              data: {
                walletId: subscription.customer.wallet!.id,
                type: "DEPOSIT_CHARGE",
                amountPaise: -depositAmount,
                balanceAfterPaise: newBalance,
                description: `Quarterly bottle deposit (Month ${newCycleCount})`,
                referenceId: subscription.id,
                referenceType: "subscription_deposit"
              }
            })
          ])

          results.depositsCharged++
          results.totalDepositAmount += depositAmount
        }

      } catch (err) {
        console.error(`Error processing subscription ${subscription.id}:`, err)
        results.errors.push(subscription.id)
      }
    }

    console.log("Monthly cycle results:", results)

    return NextResponse.json({
      success: true,
      month: currentMonthYear,
      results
    })

  } catch (err) {
    console.error("Monthly cycle cron error:", err)
    return NextResponse.json({ error: "Monthly cycle failed" }, { status: 500 })
  }
}

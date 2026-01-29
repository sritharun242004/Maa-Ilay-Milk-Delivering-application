import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyCronSecret } from "@/lib/api-utils"
import { 
  PENALTY_TRIGGER_DAYS, 
  PENALTY_LARGE_BOTTLE_PAISE, 
  PENALTY_SMALL_BOTTLE_PAISE 
} from "@/lib/constants"
import { getISTDate, daysDifference } from "@/lib/utils"

// This cron job runs daily at midnight IST
// It checks for bottles that haven't been returned for 7+ days and applies penalties
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const today = getISTDate()
    const penaltyThreshold = new Date(today)
    penaltyThreshold.setDate(penaltyThreshold.getDate() - PENALTY_TRIGGER_DAYS)

    console.log("Checking penalties for bottles issued before:", penaltyThreshold.toISOString().split('T')[0])

    // Get all bottle ledger entries that:
    // 1. Are ISSUED
    // 2. Were issued more than 7 days ago
    // 3. Haven't had penalty applied yet
    const overdueBottles = await prisma.bottleLedger.findMany({
      where: {
        action: "ISSUED",
        issuedDate: {
          lte: penaltyThreshold
        },
        penaltyAppliedAt: null
      },
      include: {
        customer: {
          include: {
            wallet: true
          }
        }
      },
      orderBy: [
        { customerId: "asc" },
        { issuedDate: "asc" } // FIFO - oldest first
      ]
    })

    const results = {
      penaltiesApplied: 0,
      totalPenaltyAmount: 0,
      errors: [] as string[]
    }

    // Group by customer and process one penalty per customer per day (FIFO)
    const processedCustomers = new Set<string>()

    for (const bottle of overdueBottles) {
      // Only process one bottle per customer per cron run (FIFO)
      if (processedCustomers.has(bottle.customerId)) {
        continue
      }

      try {
        if (!bottle.customer.wallet) {
          continue
        }

        const penaltyAmount = bottle.size === "LARGE" 
          ? PENALTY_LARGE_BOTTLE_PAISE 
          : PENALTY_SMALL_BOTTLE_PAISE

        const currentBalance = bottle.customer.wallet.balancePaise
        const newBalance = currentBalance - penaltyAmount

        await prisma.$transaction([
          // Mark bottle as penalty charged
          prisma.bottleLedger.update({
            where: { id: bottle.id },
            data: { penaltyAppliedAt: today }
          }),

          // Create penalty ledger entry
          prisma.bottleLedger.create({
            data: {
              customerId: bottle.customerId,
              action: "PENALTY_CHARGED",
              size: bottle.size,
              quantity: 1,
              largeBottleBalanceAfter: bottle.largeBottleBalanceAfter,
              smallBottleBalanceAfter: bottle.smallBottleBalanceAfter,
              description: `Penalty for ${bottle.size.toLowerCase()} bottle not returned (issued ${bottle.issuedDate?.toISOString().split('T')[0]})`
            }
          }),

          // Deduct from wallet
          prisma.wallet.update({
            where: { id: bottle.customer.wallet!.id },
            data: {
              balancePaise: newBalance,
              negativeBalanceSince: newBalance < 0 
                ? (bottle.customer.wallet!.negativeBalanceSince || today)
                : null
            }
          }),

          // Create wallet transaction
          prisma.walletTransaction.create({
            data: {
              walletId: bottle.customer.wallet!.id,
              type: "PENALTY_CHARGE",
              amountPaise: -penaltyAmount,
              balanceAfterPaise: newBalance,
              description: `Penalty: ${bottle.size.toLowerCase()} bottle not returned for ${PENALTY_TRIGGER_DAYS}+ days`,
              referenceId: bottle.id,
              referenceType: "bottle_penalty"
            }
          })
        ])

        processedCustomers.add(bottle.customerId)
        results.penaltiesApplied++
        results.totalPenaltyAmount += penaltyAmount

      } catch (err) {
        console.error(`Error processing penalty for bottle ${bottle.id}:`, err)
        results.errors.push(bottle.id)
      }
    }

    console.log("Penalty results:", results)

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      results
    })

  } catch (err) {
    console.error("Penalty cron error:", err)
    return NextResponse.json({ error: "Penalty check failed" }, { status: 500 })
  }
}

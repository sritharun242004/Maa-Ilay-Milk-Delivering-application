import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyCronSecret } from "@/lib/api-utils"
import { GRACE_PERIOD_DAYS } from "@/lib/constants"
import { getISTDate, daysDifference } from "@/lib/utils"

// This cron job runs at 5:01 PM IST daily
// It processes billing for next day's deliveries
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const today = getISTDate()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    console.log("Processing billing for:", tomorrow.toISOString().split('T')[0])

    // Get all active customers with subscriptions
    const activeCustomers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        subscription: true,
        wallet: true,
        pauses: {
          where: {
            pauseDate: tomorrow
          }
        },
        deliveryPerson: true
      }
    })

    // Check for holidays
    const holiday = await prisma.holiday.findUnique({
      where: { date: tomorrow }
    })

    const results = {
      processed: 0,
      paused: 0,
      blocked: 0,
      holiday: 0,
      errors: [] as string[]
    }

    for (const customer of activeCustomers) {
      try {
        if (!customer.subscription || !customer.wallet || !customer.deliveryPersonId) {
          continue
        }

        // Check if paused
        const isPaused = customer.pauses.length > 0
        
        // Check if holiday
        const isHoliday = !!holiday

        if (isPaused || isHoliday) {
          // Create delivery record with PAUSED/HOLIDAY status
          await prisma.delivery.upsert({
            where: {
              customerId_deliveryDate: {
                customerId: customer.id,
                deliveryDate: tomorrow
              }
            },
            create: {
              customerId: customer.id,
              deliveryPersonId: customer.deliveryPersonId,
              deliveryDate: tomorrow,
              quantityMl: customer.subscription.dailyQuantityMl,
              largeBottles: customer.subscription.largeBotles,
              smallBottles: customer.subscription.smallBottles,
              chargePaise: 0, // No charge for paused/holiday
              status: isHoliday ? "HOLIDAY" : "PAUSED"
            },
            update: {
              status: isHoliday ? "HOLIDAY" : "PAUSED",
              chargePaise: 0
            }
          })

          if (isHoliday) {
            results.holiday++
          } else {
            results.paused++
          }
          continue
        }

        // Check wallet balance
        const dailyCharge = customer.subscription.dailyPricePaise
        const currentBalance = customer.wallet.balancePaise

        if (currentBalance < dailyCharge) {
          // Check grace period
          const negativeBalanceSince = customer.wallet.negativeBalanceSince
          
          if (negativeBalanceSince) {
            const daysNegative = daysDifference(negativeBalanceSince, today)
            
            if (daysNegative >= GRACE_PERIOD_DAYS) {
              // Grace period exceeded - block customer
              await prisma.customer.update({
                where: { id: customer.id },
                data: { status: "BLOCKED" }
              })

              // Create blocked delivery
              await prisma.delivery.upsert({
                where: {
                  customerId_deliveryDate: {
                    customerId: customer.id,
                    deliveryDate: tomorrow
                  }
                },
                create: {
                  customerId: customer.id,
                  deliveryPersonId: customer.deliveryPersonId,
                  deliveryDate: tomorrow,
                  quantityMl: customer.subscription.dailyQuantityMl,
                  largeBottles: customer.subscription.largeBotles,
                  smallBottles: customer.subscription.smallBottles,
                  chargePaise: 0,
                  status: "BLOCKED"
                },
                update: {
                  status: "BLOCKED",
                  chargePaise: 0
                }
              })

              results.blocked++
              continue
            }
          } else {
            // First day going negative - set timestamp
            await prisma.wallet.update({
              where: { id: customer.wallet.id },
              data: { negativeBalanceSince: today }
            })
          }
        }

        // Process billing - deduct from wallet
        const newBalance = currentBalance - dailyCharge

        await prisma.$transaction([
          // Update wallet
          prisma.wallet.update({
            where: { id: customer.wallet.id },
            data: {
              balancePaise: newBalance,
              negativeBalanceSince: newBalance < 0 
                ? (customer.wallet.negativeBalanceSince || today) 
                : null
            }
          }),

          // Create wallet transaction
          prisma.walletTransaction.create({
            data: {
              walletId: customer.wallet.id,
              type: "MILK_CHARGE",
              amountPaise: -dailyCharge,
              balanceAfterPaise: newBalance,
              description: `Milk delivery charge for ${tomorrow.toISOString().split('T')[0]}`,
              referenceType: "delivery"
            }
          }),

          // Create delivery record
          prisma.delivery.upsert({
            where: {
              customerId_deliveryDate: {
                customerId: customer.id,
                deliveryDate: tomorrow
              }
            },
            create: {
              customerId: customer.id,
              deliveryPersonId: customer.deliveryPersonId,
              deliveryDate: tomorrow,
              quantityMl: customer.subscription.dailyQuantityMl,
              largeBottles: customer.subscription.largeBotles,
              smallBottles: customer.subscription.smallBottles,
              chargePaise: dailyCharge,
              status: "SCHEDULED"
            },
            update: {
              chargePaise: dailyCharge,
              status: "SCHEDULED"
            }
          })
        ])

        results.processed++

      } catch (err) {
        console.error(`Error processing customer ${customer.id}:`, err)
        results.errors.push(customer.id)
      }
    }

    console.log("Billing results:", results)

    return NextResponse.json({
      success: true,
      date: tomorrow.toISOString().split('T')[0],
      results
    })

  } catch (err) {
    console.error("Billing cron error:", err)
    return NextResponse.json({ error: "Billing failed" }, { status: 500 })
  }
}

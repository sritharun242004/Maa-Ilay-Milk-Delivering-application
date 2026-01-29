import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireDelivery } from "@/lib/api-utils"
import { getISTDate } from "@/lib/utils"

// Get today's delivery list for this delivery person
export async function GET() {
  try {
    const { error, session } = await requireDelivery()
    if (error) return error

    const today = getISTDate()
    today.setHours(0, 0, 0, 0)

    // Get deliveries assigned to this delivery person
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: session!.user.id,
        deliveryDate: today
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            pincode: true,
            deliveryNotes: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })

    // Get bottle balances for each customer
    const customerIds = deliveries.map(d => d.customerId)
    const bottleBalances = await prisma.bottleLedger.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: customerIds }
      },
      _max: {
        largeBottleBalanceAfter: true,
        smallBottleBalanceAfter: true,
        createdAt: true
      }
    })

    // Create a map for quick lookup
    const balanceMap = new Map(
      bottleBalances.map(b => [
        b.customerId,
        {
          largeBottles: b._max.largeBottleBalanceAfter || 0,
          smallBottles: b._max.smallBottleBalanceAfter || 0
        }
      ])
    )

    // Enhance deliveries with bottle balance
    const enhancedDeliveries = deliveries.map(d => ({
      ...d,
      customerBottleBalance: balanceMap.get(d.customerId) || { largeBottles: 0, smallBottles: 0 }
    }))

    // Calculate summary
    const summary = {
      total: deliveries.length,
      scheduled: deliveries.filter(d => d.status === "SCHEDULED").length,
      delivered: deliveries.filter(d => d.status === "DELIVERED").length,
      notDelivered: deliveries.filter(d => d.status === "NOT_DELIVERED").length,
      paused: deliveries.filter(d => d.status === "PAUSED" || d.status === "HOLIDAY").length,
      totalLargeBottles: deliveries.filter(d => d.status === "SCHEDULED").reduce((sum, d) => sum + d.largeBottles, 0),
      totalSmallBottles: deliveries.filter(d => d.status === "SCHEDULED").reduce((sum, d) => sum + d.smallBottles, 0)
    }

    return successResponse({
      date: today.toISOString().split('T')[0],
      deliveries: enhancedDeliveries,
      summary
    })

  } catch (err) {
    console.error("Get today's deliveries error:", err)
    return errorResponse("Failed to fetch deliveries", 500)
  }
}

import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils"
import { getISTDate, getISTDateString } from "@/lib/utils"

// Get admin dashboard data
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const today = getISTDate()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get counts
    const [
      pendingApprovals,
      activeCustomers,
      totalCustomers,
      activeDeliveryPersons,
      todaysDeliveries,
      tomorrowsDeliveries,
      inventory
    ] = await Promise.all([
      // Pending approvals
      prisma.customer.count({
        where: { status: "PENDING_APPROVAL" }
      }),
      // Active customers
      prisma.customer.count({
        where: { status: "ACTIVE" }
      }),
      // Total customers
      prisma.customer.count(),
      // Active delivery persons
      prisma.deliveryPerson.count({
        where: { isActive: true }
      }),
      // Today's deliveries
      prisma.delivery.findMany({
        where: {
          deliveryDate: today
        },
        include: {
          customer: {
            select: { name: true, phone: true }
          }
        }
      }),
      // Tomorrow's deliveries
      prisma.delivery.count({
        where: {
          deliveryDate: tomorrow,
          status: "SCHEDULED"
        }
      }),
      // Inventory
      prisma.inventory.findFirst()
    ])

    // Calculate today's delivery stats
    const todayStats = {
      total: todaysDeliveries.length,
      delivered: todaysDeliveries.filter(d => d.status === "DELIVERED").length,
      notDelivered: todaysDeliveries.filter(d => d.status === "NOT_DELIVERED").length,
      paused: todaysDeliveries.filter(d => d.status === "PAUSED").length,
      scheduled: todaysDeliveries.filter(d => d.status === "SCHEDULED").length
    }

    // Get bottle balance summary (bottles with customers)
    const bottleStats = await prisma.bottleLedger.groupBy({
      by: ["customerId"],
      _max: {
        largeBottleBalanceAfter: true,
        smallBottleBalanceAfter: true
      }
    })

    const totalBottlesWithCustomers = {
      large: bottleStats.reduce((sum, b) => sum + (b._max.largeBottleBalanceAfter || 0), 0),
      small: bottleStats.reduce((sum, b) => sum + (b._max.smallBottleBalanceAfter || 0), 0)
    }

    // Get recent wallet transactions (cash flow)
    const recentTransactions = await prisma.walletTransaction.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        wallet: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    })

    // Calculate today's revenue
    const todayRevenue = todaysDeliveries
      .filter(d => d.status === "DELIVERED")
      .reduce((sum, d) => sum + d.chargePaise + d.depositPaise, 0)

    return successResponse({
      overview: {
        pendingApprovals,
        activeCustomers,
        totalCustomers,
        activeDeliveryPersons
      },
      todayStats,
      tomorrowDeliveries: tomorrowsDeliveries,
      inventory: {
        totalLarge: inventory?.largeBottlesTotal || 0,
        totalSmall: inventory?.smallBottlesTotal || 0,
        inCirculationLarge: totalBottlesWithCustomers.large,
        inCirculationSmall: totalBottlesWithCustomers.small,
        availableLarge: (inventory?.largeBottlesTotal || 0) - totalBottlesWithCustomers.large,
        availableSmall: (inventory?.smallBottlesTotal || 0) - totalBottlesWithCustomers.small
      },
      todayRevenue,
      recentTransactions
    })

  } catch (err) {
    console.error("Dashboard error:", err)
    return errorResponse("Failed to fetch dashboard data", 500)
  }
}

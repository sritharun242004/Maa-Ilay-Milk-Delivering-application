import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireDelivery } from "@/lib/api-utils"
import { getISTDate } from "@/lib/utils"

// Get load summary for today (what to load in vehicle)
export async function GET() {
  try {
    const { error, session } = await requireDelivery()
    if (error) return error

    const today = getISTDate()
    today.setHours(0, 0, 0, 0)

    // Get all scheduled deliveries for today
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: session!.user.id,
        deliveryDate: today,
        status: "SCHEDULED"
      }
    })

    // Calculate totals
    const totalLargeBottles = deliveries.reduce((sum, d) => sum + d.largeBottles, 0)
    const totalSmallBottles = deliveries.reduce((sum, d) => sum + d.smallBottles, 0)
    const totalQuantityMl = deliveries.reduce((sum, d) => sum + d.quantityMl, 0)

    return successResponse({
      date: today.toISOString().split('T')[0],
      loadSummary: {
        largeBottles: totalLargeBottles,
        smallBottles: totalSmallBottles,
        totalQuantityLiters: totalQuantityMl / 1000,
        totalDeliveries: deliveries.length
      }
    })

  } catch (err) {
    console.error("Get summary error:", err)
    return errorResponse("Failed to fetch summary", 500)
  }
}

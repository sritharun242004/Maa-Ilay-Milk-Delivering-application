import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireCustomer } from "@/lib/api-utils"
import { pauseRequestSchema } from "@/lib/validations"
import { MAX_PAUSE_DAYS_PER_MONTH } from "@/lib/constants"
import { getISTDate, getEarliestPausableDate, isSameDay, parseISTDate } from "@/lib/utils"

// Get pause status and upcoming pauses
export async function GET() {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const customer = await prisma.customer.findUnique({
      where: { email: session!.user.email! }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    // Get current month pause count
    const now = getISTDate()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const pauseDaysThisMonth = await prisma.pause.count({
      where: {
        customerId: customer.id,
        pauseDate: {
          gte: monthStart,
          lte: monthEnd
        },
        createdByCustomer: true
      }
    })

    // Get upcoming pauses
    const upcomingPauses = await prisma.pause.findMany({
      where: {
        customerId: customer.id,
        pauseDate: {
          gte: now
        }
      },
      orderBy: { pauseDate: "asc" }
    })

    // Get earliest pausable date
    const earliestPausableDate = getEarliestPausableDate()

    return successResponse({
      pauseDaysUsed: pauseDaysThisMonth,
      maxPauseDays: MAX_PAUSE_DAYS_PER_MONTH,
      remainingPauseDays: Math.max(0, MAX_PAUSE_DAYS_PER_MONTH - pauseDaysThisMonth),
      upcomingPauses,
      earliestPausableDate: earliestPausableDate.toISOString().split('T')[0]
    })

  } catch (err) {
    console.error("Get pause status error:", err)
    return errorResponse("Failed to fetch pause status", 500)
  }
}

// Create pause(s)
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const body = await request.json()
    
    const result = pauseRequestSchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { dates } = result.data

    const customer = await prisma.customer.findUnique({
      where: { email: session!.user.email! }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    if (customer.status !== "ACTIVE") {
      return errorResponse("Your subscription is not active", 400)
    }

    // Validate dates
    const now = getISTDate()
    const earliestPausable = getEarliestPausableDate()
    const parsedDates = dates.map(d => parseISTDate(d))

    for (const date of parsedDates) {
      if (date < earliestPausable) {
        return errorResponse(
          `Cannot pause for ${date.toDateString()}. Earliest pausable date is ${earliestPausable.toDateString()}`,
          400
        )
      }
    }

    // Check monthly limit for each date's month
    const datesByMonth = new Map<string, Date[]>()
    for (const date of parsedDates) {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      if (!datesByMonth.has(monthKey)) {
        datesByMonth.set(monthKey, [])
      }
      datesByMonth.get(monthKey)!.push(date)
    }

    for (const [monthKey, monthDates] of datesByMonth) {
      const [year, month] = monthKey.split('-').map(Number)
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)

      const existingPauses = await prisma.pause.count({
        where: {
          customerId: customer.id,
          pauseDate: {
            gte: monthStart,
            lte: monthEnd
          },
          createdByCustomer: true
        }
      })

      if (existingPauses + monthDates.length > MAX_PAUSE_DAYS_PER_MONTH) {
        return errorResponse(
          `You can only pause ${MAX_PAUSE_DAYS_PER_MONTH} days per month. You have ${MAX_PAUSE_DAYS_PER_MONTH - existingPauses} remaining for ${monthStart.toLocaleString('default', { month: 'long' })}.`,
          400
        )
      }
    }

    // Create pauses
    const createdPauses = await prisma.$transaction(
      parsedDates.map(date => 
        prisma.pause.upsert({
          where: {
            customerId_pauseDate: {
              customerId: customer.id,
              pauseDate: date
            }
          },
          create: {
            customerId: customer.id,
            pauseDate: date,
            createdByCustomer: true
          },
          update: {} // No update if exists
        })
      )
    )

    return successResponse({ 
      pauses: createdPauses,
      message: `Successfully paused delivery for ${createdPauses.length} day(s)`
    })

  } catch (err) {
    console.error("Create pause error:", err)
    return errorResponse("Failed to create pause", 500)
  }
}

// Cancel pause
export async function DELETE(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")

    if (!dateStr) {
      return errorResponse("Date is required", 400)
    }

    const customer = await prisma.customer.findUnique({
      where: { email: session!.user.email! }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    const pauseDate = parseISTDate(dateStr)
    const earliestPausable = getEarliestPausableDate()

    // Can only cancel future pauses (respecting cutoff)
    if (pauseDate < earliestPausable) {
      return errorResponse("Cannot cancel this pause. It's too close to delivery time.", 400)
    }

    // Delete the pause
    await prisma.pause.deleteMany({
      where: {
        customerId: customer.id,
        pauseDate,
        createdByCustomer: true
      }
    })

    return successResponse({ message: "Pause cancelled successfully" })

  } catch (err) {
    console.error("Cancel pause error:", err)
    return errorResponse("Failed to cancel pause", 500)
  }
}

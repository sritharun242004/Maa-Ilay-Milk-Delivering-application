import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireAdmin } from "@/lib/api-utils"
import { holidaySchema } from "@/lib/validations"
import { parseISTDate } from "@/lib/utils"

// Get all holidays
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date()
        }
      },
      orderBy: { date: "asc" }
    })

    return successResponse({ holidays })

  } catch (err) {
    console.error("Get holidays error:", err)
    return errorResponse("Failed to fetch holidays", 500)
  }
}

// Create holiday (bulk pause for all customers)
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const body = await request.json()

    const result = holidaySchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { date, reason } = result.data
    const holidayDate = parseISTDate(date)

    // Check if holiday already exists
    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate }
    })

    if (existing) {
      return errorResponse("A holiday is already declared for this date", 400)
    }

    // Create holiday
    const holiday = await prisma.holiday.create({
      data: {
        date: holidayDate,
        reason,
        createdByAdminId: session!.user.id
      }
    })

    // Get all active customers
    const activeCustomers = await prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true }
    })

    // Create pause for all active customers
    if (activeCustomers.length > 0) {
      await prisma.pause.createMany({
        data: activeCustomers.map(c => ({
          customerId: c.id,
          pauseDate: holidayDate,
          createdByCustomer: false,
          createdByAdminId: session!.user.id,
          reason: `Holiday: ${reason}`
        })),
        skipDuplicates: true
      })
    }

    // Update any scheduled deliveries to HOLIDAY status
    await prisma.delivery.updateMany({
      where: {
        deliveryDate: holidayDate,
        status: "SCHEDULED"
      },
      data: {
        status: "HOLIDAY"
      }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "holiday_created",
        entityType: "holiday",
        entityId: holiday.id,
        newValue: { date, reason, affectedCustomers: activeCustomers.length }
      }
    })

    return successResponse({
      holiday,
      affectedCustomers: activeCustomers.length,
      message: `Holiday declared. ${activeCustomers.length} customers affected.`
    }, 201)

  } catch (err) {
    console.error("Create holiday error:", err)
    return errorResponse("Failed to create holiday", 500)
  }
}

// Delete holiday
export async function DELETE(request: NextRequest) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return errorResponse("Date is required", 400)
    }

    const holidayDate = parseISTDate(date)

    // Delete holiday
    const holiday = await prisma.holiday.delete({
      where: { date: holidayDate }
    })

    // Delete associated pauses (admin-created only)
    await prisma.pause.deleteMany({
      where: {
        pauseDate: holidayDate,
        createdByCustomer: false
      }
    })

    // Revert HOLIDAY deliveries back to SCHEDULED
    await prisma.delivery.updateMany({
      where: {
        deliveryDate: holidayDate,
        status: "HOLIDAY"
      },
      data: {
        status: "SCHEDULED"
      }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "holiday_deleted",
        entityType: "holiday",
        entityId: holiday.id
      }
    })

    return successResponse({ message: "Holiday removed successfully" })

  } catch (err) {
    console.error("Delete holiday error:", err)
    return errorResponse("Failed to delete holiday", 500)
  }
}

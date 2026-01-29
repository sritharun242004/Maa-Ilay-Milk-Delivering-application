import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils"

// Get single delivery person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const { id } = await params

    const deliveryPerson = await prisma.deliveryPerson.findUnique({
      where: { id },
      include: {
        customers: {
          include: {
            subscription: true,
            wallet: true
          }
        },
        deliveries: {
          where: {
            deliveryDate: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7))
            }
          },
          orderBy: { deliveryDate: "desc" }
        }
      }
    })

    if (!deliveryPerson) {
      return errorResponse("Delivery person not found", 404)
    }

    // Remove password from response
    const { password: _, ...safeDeliveryPerson } = deliveryPerson

    return successResponse({ deliveryPerson: safeDeliveryPerson })

  } catch (err) {
    console.error("Get delivery person error:", err)
    return errorResponse("Failed to fetch delivery person", 500)
  }
}

// Update delivery person
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const { name, phone, zone, password, isActive } = body

    const currentPerson = await prisma.deliveryPerson.findUnique({
      where: { id }
    })

    if (!currentPerson) {
      return errorResponse("Delivery person not found", 404)
    }

    // If phone is being changed, check for duplicates
    if (phone && phone !== currentPerson.phone) {
      const existing = await prisma.deliveryPerson.findUnique({
        where: { phone }
      })
      if (existing) {
        return errorResponse("This phone number is already in use", 400)
      }
    }

    // Build update data
    const updateData: any = {}
    if (name) updateData.name = name
    if (phone) updateData.phone = phone
    if (zone !== undefined) updateData.zone = zone
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.password = await bcrypt.hash(password, 12)

    const deliveryPerson = await prisma.deliveryPerson.update({
      where: { id },
      data: updateData
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "delivery_person_updated",
        entityType: "delivery_person",
        entityId: id,
        oldValue: { name: currentPerson.name, phone: currentPerson.phone, zone: currentPerson.zone },
        newValue: { name: deliveryPerson.name, phone: deliveryPerson.phone, zone: deliveryPerson.zone }
      }
    })

    const { password: _, ...safeDeliveryPerson } = deliveryPerson

    return successResponse({ deliveryPerson: safeDeliveryPerson })

  } catch (err) {
    console.error("Update delivery person error:", err)
    return errorResponse("Failed to update delivery person", 500)
  }
}

// Delete (deactivate) delivery person
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params

    // Check if delivery person has active customers
    const activeCustomers = await prisma.customer.count({
      where: {
        deliveryPersonId: id,
        status: { in: ["ACTIVE", "PENDING_PAYMENT"] }
      }
    })

    if (activeCustomers > 0) {
      return errorResponse(
        `Cannot deactivate. This delivery person has ${activeCustomers} active customer(s). Please reassign them first.`,
        400
      )
    }

    // Deactivate instead of delete
    await prisma.deliveryPerson.update({
      where: { id },
      data: { isActive: false }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "delivery_person_deactivated",
        entityType: "delivery_person",
        entityId: id
      }
    })

    return successResponse({ message: "Delivery person deactivated successfully" })

  } catch (err) {
    console.error("Delete delivery person error:", err)
    return errorResponse("Failed to deactivate delivery person", 500)
  }
}

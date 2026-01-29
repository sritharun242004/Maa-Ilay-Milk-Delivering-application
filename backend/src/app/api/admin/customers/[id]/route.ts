import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils"

// Get single customer details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        subscription: true,
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 50
            }
          }
        },
        deliveryPerson: true,
        deliveries: {
          orderBy: { deliveryDate: "desc" },
          take: 30
        },
        pauses: {
          orderBy: { pauseDate: "desc" },
          take: 30
        },
        bottleLedger: {
          orderBy: { createdAt: "desc" },
          take: 50
        }
      }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    // Calculate bottle balance
    const latestBottleEntry = customer.bottleLedger[0]
    const bottleBalance = {
      large: latestBottleEntry?.largeBottleBalanceAfter ?? 0,
      small: latestBottleEntry?.smallBottleBalanceAfter ?? 0
    }

    return successResponse({ customer, bottleBalance })

  } catch (err) {
    console.error("Get customer error:", err)
    return errorResponse("Failed to fetch customer", 500)
  }
}

// Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      pincode,
      deliveryPersonId,
      deliveryNotes,
      status
    } = body

    // Get current customer for audit
    const currentCustomer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!currentCustomer) {
      return errorResponse("Customer not found", 404)
    }

    // Update customer
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(addressLine1 && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2 }),
        ...(landmark !== undefined && { landmark }),
        ...(city && { city }),
        ...(pincode && { pincode }),
        ...(deliveryPersonId && { deliveryPersonId }),
        ...(deliveryNotes !== undefined && { deliveryNotes }),
        ...(status && { status })
      }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "customer_updated",
        entityType: "customer",
        entityId: id,
        oldValue: currentCustomer as any,
        newValue: customer as any
      }
    })

    return successResponse({ customer })

  } catch (err) {
    console.error("Update customer error:", err)
    return errorResponse("Failed to update customer", 500)
  }
}

import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireAdmin } from "@/lib/api-utils"
import { approveCustomerSchema } from "@/lib/validations"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const result = approveCustomerSchema.safeParse({ ...body, customerId: id })
    if (!result.success) {
      return validationError(result.error)
    }

    const { approved, deliveryPersonId, rejectionReason } = result.data

    const customer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    if (customer.status !== "PENDING_APPROVAL") {
      return errorResponse("Customer is not pending approval", 400)
    }

    if (approved) {
      // Verify delivery person exists
      const deliveryPerson = await prisma.deliveryPerson.findUnique({
        where: { id: deliveryPersonId }
      })

      if (!deliveryPerson || !deliveryPerson.isActive) {
        return errorResponse("Invalid delivery person", 400)
      }

      // Approve customer
      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: {
          status: "PENDING_PAYMENT",
          approvedAt: new Date(),
          approvedBy: session!.user.id,
          deliveryPersonId
        }
      })

      // Create audit log
      await prisma.adminAuditLog.create({
        data: {
          adminId: session!.user.id,
          action: "customer_approved",
          entityType: "customer",
          entityId: id,
          newValue: { approved: true, deliveryPersonId }
        }
      })

      return successResponse({ 
        customer: updatedCustomer,
        message: "Customer approved successfully" 
      })
    } else {
      // Reject customer
      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: {
          status: "INACTIVE",
          rejectionReason
        }
      })

      // Create audit log
      await prisma.adminAuditLog.create({
        data: {
          adminId: session!.user.id,
          action: "customer_rejected",
          entityType: "customer",
          entityId: id,
          newValue: { approved: false, rejectionReason }
        }
      })

      return successResponse({ 
        customer: updatedCustomer,
        message: "Customer rejected" 
      })
    }

  } catch (err) {
    console.error("Approve customer error:", err)
    return errorResponse("Failed to process approval", 500)
  }
}

import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { successResponse, errorResponse, validationError, requireAdmin } from "@/lib/api-utils"
import { createDeliveryPersonSchema } from "@/lib/validations"

// Get all delivery persons
export async function GET() {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const deliveryPersons = await prisma.deliveryPerson.findMany({
      include: {
        _count: {
          select: { customers: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return successResponse({ deliveryPersons })

  } catch (err) {
    console.error("Get delivery persons error:", err)
    return errorResponse("Failed to fetch delivery persons", 500)
  }
}

// Create new delivery person
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const body = await request.json()

    const result = createDeliveryPersonSchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { name, phone, zone, password } = result.data

    // Check if phone already exists
    const existing = await prisma.deliveryPerson.findUnique({
      where: { phone }
    })

    if (existing) {
      return errorResponse("A delivery person with this phone number already exists", 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create delivery person
    const deliveryPerson = await prisma.deliveryPerson.create({
      data: {
        name,
        phone,
        zone,
        password: hashedPassword,
        createdByAdminId: session!.user.id
      }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "delivery_person_created",
        entityType: "delivery_person",
        entityId: deliveryPerson.id,
        newValue: { name, phone, zone }
      }
    })

    // Return without password
    const { password: _, ...safeDeliveryPerson } = deliveryPerson

    return successResponse({ 
      deliveryPerson: safeDeliveryPerson,
      message: "Delivery person created successfully"
    }, 201)

  } catch (err) {
    console.error("Create delivery person error:", err)
    return errorResponse("Failed to create delivery person", 500)
  }
}

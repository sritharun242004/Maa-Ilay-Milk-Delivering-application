import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils"

// Get all customers with filters
export async function GET(request: NextRequest) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const deliveryPersonId = searchParams.get("deliveryPersonId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (deliveryPersonId) {
      where.deliveryPersonId = deliveryPersonId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { addressLine1: { contains: search, mode: "insensitive" } }
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          subscription: true,
          wallet: true,
          deliveryPerson: {
            select: { id: true, name: true, phone: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.customer.count({ where })
    ])

    return successResponse({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (err) {
    console.error("Get customers error:", err)
    return errorResponse("Failed to fetch customers", 500)
  }
}

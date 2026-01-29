import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, requireCustomer } from "@/lib/api-utils"

// Get customer profile
export async function GET() {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const customer = await prisma.customer.findUnique({
      where: { email: session!.user.email! },
      include: {
        subscription: true,
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 20
            }
          }
        },
        deliveryPerson: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        pauses: {
          where: {
            pauseDate: {
              gte: new Date()
            }
          },
          orderBy: { pauseDate: "asc" }
        }
      }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    // Get bottle balance
    const bottleBalance = await getBottleBalance(customer.id)

    // Get delivery history
    const deliveries = await prisma.delivery.findMany({
      where: { customerId: customer.id },
      orderBy: { deliveryDate: "desc" },
      take: 30
    })

    // Get pause days used this month
    const now = new Date()
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

    return successResponse({
      customer,
      bottleBalance,
      deliveries,
      pauseDaysUsedThisMonth: pauseDaysThisMonth
    })

  } catch (err) {
    console.error("Get profile error:", err)
    return errorResponse("Failed to fetch profile", 500)
  }
}

// Update customer profile (limited fields)
export async function PATCH(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    const body = await request.json()
    const { deliveryNotes } = body

    const customer = await prisma.customer.update({
      where: { email: session!.user.email! },
      data: {
        deliveryNotes
      }
    })

    return successResponse({ customer })

  } catch (err) {
    console.error("Update profile error:", err)
    return errorResponse("Failed to update profile", 500)
  }
}

// Helper function to get bottle balance
async function getBottleBalance(customerId: string) {
  const latestLedgerEntry = await prisma.bottleLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" }
  })

  return {
    largeBottles: latestLedgerEntry?.largeBottleBalanceAfter ?? 0,
    smallBottles: latestLedgerEntry?.smallBottleBalanceAfter ?? 0
  }
}

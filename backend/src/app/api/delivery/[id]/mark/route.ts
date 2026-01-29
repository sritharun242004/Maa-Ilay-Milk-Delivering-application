import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireDelivery } from "@/lib/api-utils"
import { markDeliverySchema } from "@/lib/validations"

// Mark delivery as delivered/not delivered
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireDelivery()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const result = markDeliverySchema.safeParse({ ...body, deliveryId: id })
    if (!result.success) {
      return validationError(result.error)
    }

    const { status, largeBottlesCollected, smallBottlesCollected, notes } = result.data

    // Get the delivery
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        customer: true
      }
    })

    if (!delivery) {
      return errorResponse("Delivery not found", 404)
    }

    // Verify this delivery belongs to this delivery person
    if (delivery.deliveryPersonId !== session!.user.id) {
      return errorResponse("Unauthorized", 403)
    }

    // Can only mark scheduled deliveries
    if (delivery.status !== "SCHEDULED") {
      return errorResponse("This delivery cannot be marked. Status: " + delivery.status, 400)
    }

    // Update delivery
    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: {
        status,
        deliveredAt: status === "DELIVERED" ? new Date() : null,
        largeBottlesCollected,
        smallBottlesCollected,
        deliveryNotes: notes
      }
    })

    // If bottles were collected, update bottle ledger
    if (largeBottlesCollected > 0 || smallBottlesCollected > 0) {
      // Get current bottle balance
      const latestLedger = await prisma.bottleLedger.findFirst({
        where: { customerId: delivery.customerId },
        orderBy: { createdAt: "desc" }
      })

      const currentLarge = latestLedger?.largeBottleBalanceAfter || 0
      const currentSmall = latestLedger?.smallBottleBalanceAfter || 0

      // Create ledger entries for returned bottles
      if (largeBottlesCollected > 0) {
        await prisma.bottleLedger.create({
          data: {
            customerId: delivery.customerId,
            action: "RETURNED",
            size: "LARGE",
            quantity: largeBottlesCollected,
            largeBottleBalanceAfter: Math.max(0, currentLarge - largeBottlesCollected),
            smallBottleBalanceAfter: currentSmall,
            deliveryId: id,
            description: `${largeBottlesCollected} large bottle(s) returned`,
            performedByDeliveryPersonId: session!.user.id
          }
        })
      }

      if (smallBottlesCollected > 0) {
        // Get updated large balance
        const updatedLedger = await prisma.bottleLedger.findFirst({
          where: { customerId: delivery.customerId },
          orderBy: { createdAt: "desc" }
        })
        const updatedLarge = updatedLedger?.largeBottleBalanceAfter || currentLarge - largeBottlesCollected

        await prisma.bottleLedger.create({
          data: {
            customerId: delivery.customerId,
            action: "RETURNED",
            size: "SMALL",
            quantity: smallBottlesCollected,
            largeBottleBalanceAfter: updatedLarge,
            smallBottleBalanceAfter: Math.max(0, currentSmall - smallBottlesCollected),
            deliveryId: id,
            description: `${smallBottlesCollected} small bottle(s) returned`,
            performedByDeliveryPersonId: session!.user.id
          }
        })
      }
    }

    // If delivered, add bottles issued to ledger
    if (status === "DELIVERED") {
      const latestLedger = await prisma.bottleLedger.findFirst({
        where: { customerId: delivery.customerId },
        orderBy: { createdAt: "desc" }
      })

      const currentLarge = latestLedger?.largeBottleBalanceAfter || 0
      const currentSmall = latestLedger?.smallBottleBalanceAfter || 0

      if (delivery.largeBottles > 0) {
        await prisma.bottleLedger.create({
          data: {
            customerId: delivery.customerId,
            action: "ISSUED",
            size: "LARGE",
            quantity: delivery.largeBottles,
            largeBottleBalanceAfter: currentLarge + delivery.largeBottles,
            smallBottleBalanceAfter: currentSmall,
            deliveryId: id,
            description: `${delivery.largeBottles} large bottle(s) issued`,
            issuedDate: new Date(),
            performedByDeliveryPersonId: session!.user.id
          }
        })
      }

      if (delivery.smallBottles > 0) {
        const updatedLedger = await prisma.bottleLedger.findFirst({
          where: { customerId: delivery.customerId },
          orderBy: { createdAt: "desc" }
        })
        const updatedLarge = updatedLedger?.largeBottleBalanceAfter || currentLarge + delivery.largeBottles

        await prisma.bottleLedger.create({
          data: {
            customerId: delivery.customerId,
            action: "ISSUED",
            size: "SMALL",
            quantity: delivery.smallBottles,
            largeBottleBalanceAfter: updatedLarge,
            smallBottleBalanceAfter: currentSmall + delivery.smallBottles,
            deliveryId: id,
            description: `${delivery.smallBottles} small bottle(s) issued`,
            issuedDate: new Date(),
            performedByDeliveryPersonId: session!.user.id
          }
        })
      }
    }

    return successResponse({
      delivery: updatedDelivery,
      message: status === "DELIVERED" ? "Delivery marked as completed" : "Delivery marked as not delivered"
    })

  } catch (err) {
    console.error("Mark delivery error:", err)
    return errorResponse("Failed to mark delivery", 500)
  }
}

import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireAdmin } from "@/lib/api-utils"
import { inventoryUpdateSchema } from "@/lib/validations"

// Get inventory status
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    // Get or create inventory record
    let inventory = await prisma.inventory.findFirst()
    
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          largeBottlesTotal: 0,
          smallBottlesTotal: 0,
          largeBottlesInCirculation: 0,
          smallBottlesInCirculation: 0
        }
      })
    }

    // Calculate bottles in circulation from ledger
    const bottleStats = await prisma.bottleLedger.groupBy({
      by: ["customerId"],
      _max: {
        largeBottleBalanceAfter: true,
        smallBottleBalanceAfter: true
      }
    })

    const inCirculation = {
      large: bottleStats.reduce((sum, b) => sum + (b._max.largeBottleBalanceAfter || 0), 0),
      small: bottleStats.reduce((sum, b) => sum + (b._max.smallBottleBalanceAfter || 0), 0)
    }

    // Get inventory logs
    const recentLogs = await prisma.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20
    })

    return successResponse({
      inventory: {
        ...inventory,
        largeBottlesInCirculation: inCirculation.large,
        smallBottlesInCirculation: inCirculation.small,
        largeBottlesAvailable: inventory.largeBottlesTotal - inCirculation.large,
        smallBottlesAvailable: inventory.smallBottlesTotal - inCirculation.small
      },
      recentLogs
    })

  } catch (err) {
    console.error("Get inventory error:", err)
    return errorResponse("Failed to fetch inventory", 500)
  }
}

// Update inventory (add/remove stock)
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const body = await request.json()

    const result = inventoryUpdateSchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { largeBottlesDelta, smallBottlesDelta, reason } = result.data

    // Get current inventory
    let inventory = await prisma.inventory.findFirst()
    
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          largeBottlesTotal: 0,
          smallBottlesTotal: 0,
          largeBottlesInCirculation: 0,
          smallBottlesInCirculation: 0
        }
      })
    }

    // Validate we're not going negative
    const newLargeTotal = inventory.largeBottlesTotal + largeBottlesDelta
    const newSmallTotal = inventory.smallBottlesTotal + smallBottlesDelta

    if (newLargeTotal < 0 || newSmallTotal < 0) {
      return errorResponse("Cannot reduce inventory below zero", 400)
    }

    // Update inventory
    const updatedInventory = await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        largeBottlesTotal: newLargeTotal,
        smallBottlesTotal: newSmallTotal,
        updatedByAdminId: session!.user.id
      }
    })

    // Create log
    await prisma.inventoryLog.create({
      data: {
        action: largeBottlesDelta >= 0 && smallBottlesDelta >= 0 ? "stock_added" : "stock_removed",
        largeBottlesDelta,
        smallBottlesDelta,
        reason,
        performedByAdminId: session!.user.id
      }
    })

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "inventory_updated",
        entityType: "inventory",
        entityId: inventory.id,
        oldValue: { large: inventory.largeBottlesTotal, small: inventory.smallBottlesTotal },
        newValue: { large: newLargeTotal, small: newSmallTotal, reason }
      }
    })

    return successResponse({
      inventory: updatedInventory,
      message: "Inventory updated successfully"
    })

  } catch (err) {
    console.error("Update inventory error:", err)
    return errorResponse("Failed to update inventory", 500)
  }
}

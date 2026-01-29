import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireAdmin } from "@/lib/api-utils"
import { walletAdjustmentSchema } from "@/lib/validations"

// Adjust customer wallet (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const result = walletAdjustmentSchema.safeParse({ ...body, customerId: id })
    if (!result.success) {
      return validationError(result.error)
    }

    const { amountPaise, description, type } = result.data

    // Get customer with wallet
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { wallet: true }
    })

    if (!customer) {
      return errorResponse("Customer not found", 404)
    }

    if (!customer.wallet) {
      return errorResponse("Customer wallet not found", 404)
    }

    // Calculate new balance
    const adjustmentAmount = type === "ADMIN_CREDIT" ? Math.abs(amountPaise) : -Math.abs(amountPaise)
    const newBalance = customer.wallet.balancePaise + adjustmentAmount

    // Update wallet and create transaction atomically
    const [updatedWallet, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: customer.wallet.id },
        data: {
          balancePaise: newBalance,
          // Clear negative balance tracking if balance is now positive
          negativeBalanceSince: newBalance >= 0 ? null : customer.wallet.negativeBalanceSince
        }
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: customer.wallet.id,
          type: type as any,
          amountPaise: adjustmentAmount,
          balanceAfterPaise: newBalance,
          description,
          performedByAdminId: session!.user.id
        }
      })
    ])

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: session!.user.id,
        action: "wallet_adjusted",
        entityType: "wallet",
        entityId: customer.wallet.id,
        oldValue: { balance: customer.wallet.balancePaise },
        newValue: { balance: newBalance, adjustment: adjustmentAmount, description }
      }
    })

    return successResponse({
      wallet: updatedWallet,
      transaction,
      message: `Wallet ${type === "ADMIN_CREDIT" ? "credited" : "debited"} successfully`
    })

  } catch (err) {
    console.error("Wallet adjustment error:", err)
    return errorResponse("Failed to adjust wallet", 500)
  }
}

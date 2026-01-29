import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { errorResponse, requireDelivery } from "@/lib/api-utils"
import { getISTDate, formatDate } from "@/lib/utils"

// Export today's delivery list as CSV
export async function GET() {
  try {
    const { error, session } = await requireDelivery()
    if (error) return error

    const today = getISTDate()
    today.setHours(0, 0, 0, 0)

    // Get deliveries
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: session!.user.id,
        deliveryDate: today
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            pincode: true,
            deliveryNotes: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })

    // Build CSV
    const headers = [
      "S.No",
      "Customer Name",
      "Phone",
      "Address",
      "Landmark",
      "Pincode",
      "Large Bottles (1L)",
      "Small Bottles (500ml)",
      "Total Quantity",
      "Status",
      "Notes"
    ]

    const rows = deliveries.map((d, i) => [
      i + 1,
      d.customer.name,
      d.customer.phone,
      [d.customer.addressLine1, d.customer.addressLine2].filter(Boolean).join(", "),
      d.customer.landmark || "",
      d.customer.pincode,
      d.largeBottles,
      d.smallBottles,
      `${d.quantityMl / 1000}L`,
      d.status,
      d.customer.deliveryNotes || ""
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    // Return as downloadable CSV
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="deliveries-${formatDate(today)}.csv"`
      }
    })

  } catch (err) {
    console.error("Export error:", err)
    return errorResponse("Failed to export deliveries", 500)
  }
}

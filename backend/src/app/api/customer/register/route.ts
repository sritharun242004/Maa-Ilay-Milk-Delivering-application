import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { successResponse, errorResponse, validationError, requireCustomer } from "@/lib/api-utils"
import { customerRegistrationSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireCustomer()
    if (error) return error

    // Check if customer already exists with this email
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: session!.user.email! }
    })

    if (existingCustomer) {
      return errorResponse("Customer already registered", 400)
    }

    const body = await request.json()
    
    // Validate input
    const result = customerRegistrationSchema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }

    const { name, phone, addressLine1, addressLine2, landmark, city, pincode } = result.data

    // Check if phone number already exists
    const existingPhone = await prisma.customer.findUnique({
      where: { phone }
    })

    if (existingPhone) {
      return errorResponse("This phone number is already registered", 400)
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        email: session!.user.email!,
        name,
        phone,
        profileImage: session!.user.image,
        addressLine1,
        addressLine2,
        landmark,
        city,
        pincode,
        status: "PENDING_APPROVAL",
        // Create wallet with zero balance
        wallet: {
          create: {
            balancePaise: 0
          }
        }
      },
      include: {
        wallet: true
      }
    })

    return successResponse({ 
      customer,
      message: "Registration successful! Please wait for admin approval." 
    }, 201)

  } catch (err) {
    console.error("Customer registration error:", err)
    return errorResponse("Registration failed. Please try again.", 500)
  }
}

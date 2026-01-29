import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, UserRole } from "./auth"
import { ZodError } from "zod"

// API Response helpers
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function validationError(error: ZodError) {
  const messages = error.issues.map((e) => e.message).join(", ")
  return errorResponse(messages, 400)
}

// Auth helpers
export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getSession()

  if (!session?.user) {
    return { error: errorResponse("Unauthorized", 401), session: null }
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: errorResponse("Forbidden", 403), session: null }
  }

  return { error: null, session }
}

export async function requireAdmin() {
  return requireAuth(["admin"])
}

export async function requireDelivery() {
  return requireAuth(["delivery"])
}

export async function requireCustomer() {
  return requireAuth(["customer"])
}

// Cron job authorization
export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("CRON_SECRET not configured")
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

import NextAuth from "next-auth"
import { authOptionsCustomer } from "@/lib/auth-customer"

/**
 * Customer-only authentication endpoint
 * Only includes Google OAuth - no signin UI needed
 * Direct redirect to Google when accessed
 */
const handler = NextAuth(authOptionsCustomer)

export { handler as GET, handler as POST }

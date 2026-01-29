import NextAuth from "next-auth"
import { authOptionsDelivery } from "@/lib/auth-delivery"

/**
 * Delivery person-only authentication endpoint
 * Only includes credentials provider - API only, no UI
 */
const handler = NextAuth(authOptionsDelivery)

export { handler as GET, handler as POST }

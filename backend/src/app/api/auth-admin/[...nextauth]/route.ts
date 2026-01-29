import NextAuth from "next-auth"
import { authOptionsAdmin } from "@/lib/auth-admin"

/**
 * Admin-only authentication endpoint
 * Only includes credentials provider - API only, no UI
 */
const handler = NextAuth(authOptionsAdmin)

export { handler as GET, handler as POST }

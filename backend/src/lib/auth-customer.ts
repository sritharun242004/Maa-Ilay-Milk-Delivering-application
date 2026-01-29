import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import prisma from "./prisma"

export type UserRole = "customer"

declare module "next-auth" {
  interface User {
    id: string
    role: UserRole
    phone?: string
    status?: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      phone?: string
      status?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    phone?: string
    status?: string
  }
}

/**
 * NextAuth configuration for CUSTOMERS ONLY
 * Only includes Google OAuth provider - no signin UI needed
 */
export const authOptionsCustomer: NextAuthOptions = {
  providers: [
    // Google OAuth for Customers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const existingCustomer = await prisma.customer.findUnique({
            where: { email: user.email! }
          })

          if (existingCustomer) {
            user.role = "customer"
            user.id = existingCustomer.id
            user.status = existingCustomer.status
          } else {
            user.role = "customer"
            user.status = "NEW"
          }
          return true
        } catch (error) {
          console.error("SignIn error:", error)
          return true
        }
      }
      return true
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.phone = user.phone
        token.status = user.status
      }

      if (account?.provider === "google" && token.email) {
        const customer = await prisma.customer.findUnique({
          where: { email: token.email }
        })

        if (customer) {
          token.id = customer.id
          token.role = "customer"
          token.status = customer.status
          token.phone = customer.phone
        } else {
          token.role = "customer"
          token.status = "NEW"
        }
      }

      if (trigger === "update" && token.role === "customer" && token.id) {
        const customer = await prisma.customer.findUnique({
          where: { id: token.id }
        })
        if (customer) {
          token.status = customer.status
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.phone = token.phone
        session.user.status = token.status
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:5173"

      if (url.startsWith(frontendUrl)) {
        return url
      }

      if (url.startsWith("/")) {
        return `${frontendUrl}${url}`
      }

      if (url.startsWith(baseUrl)) {
        return url.replace(baseUrl, frontendUrl)
      }

      return `${frontendUrl}/customer/dashboard`
    }
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}

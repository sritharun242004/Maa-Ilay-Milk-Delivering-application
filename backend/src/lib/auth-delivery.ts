import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export type UserRole = "delivery"

/**
 * NextAuth configuration for DELIVERY PERSONS ONLY
 * Only includes credentials provider - no signin UI needed
 */
export const authOptionsDelivery: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "delivery-credentials",
      name: "Delivery Login",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) {
          throw new Error("Phone number and password are required")
        }

        const phone = credentials.phone.replace(/\D/g, '').slice(-10)

        const deliveryPerson = await prisma.deliveryPerson.findUnique({
          where: { phone }
        })

        if (!deliveryPerson || !deliveryPerson.isActive) {
          throw new Error("Invalid credentials or account disabled")
        }

        const isValid = await bcrypt.compare(credentials.password, deliveryPerson.password)

        if (!isValid) {
          throw new Error("Invalid credentials")
        }

        await prisma.deliveryPerson.update({
          where: { id: deliveryPerson.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: deliveryPerson.id,
          name: deliveryPerson.name,
          phone: deliveryPerson.phone,
          role: "delivery" as UserRole
        }
      }
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = "delivery"
        token.phone = user.phone
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = "delivery"
        session.user.phone = token.phone as string
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

      return `${frontendUrl}/delivery/today`
    }
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}

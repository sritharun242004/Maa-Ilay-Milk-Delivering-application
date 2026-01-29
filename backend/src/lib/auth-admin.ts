import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export type UserRole = "admin"

/**
 * NextAuth configuration for ADMINS ONLY
 * Only includes credentials provider - no signin UI needed
 */
export const authOptionsAdmin: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email }
        })

        if (!admin || !admin.isActive) {
          throw new Error("Invalid credentials or account disabled")
        }

        const isValid = await bcrypt.compare(credentials.password, admin.password)

        if (!isValid) {
          throw new Error("Invalid credentials")
        }

        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "admin" as UserRole
        }
      }
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = "admin"
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = "admin"
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

      return `${frontendUrl}/admin/dashboard`
    }
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}

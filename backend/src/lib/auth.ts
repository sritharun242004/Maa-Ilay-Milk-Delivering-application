import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export type UserRole = "customer" | "admin" | "delivery"

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

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth for Customers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",  // Changed from "consent" to allow account selection
          access_type: "offline",
          response_type: "code"
        }
      },
      // Allow dangerous email account linking for development
      allowDangerousEmailAccountLinking: true,
    }),

    // Credentials for Admin
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

        // Update last login
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

    // Credentials for Delivery Person
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

        // Clean phone number (remove spaces, dashes, country code)
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

        // Update last login
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
    })
  ],

  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in (customers)
      if (account?.provider === "google") {
        try {
          // Check if customer exists
          const existingCustomer = await prisma.customer.findUnique({
            where: { email: user.email! }
          })

          if (existingCustomer) {
            // Update role info for existing customer
            user.role = "customer"
            user.id = existingCustomer.id
            user.status = existingCustomer.status
          } else {
            // New customer - will need to complete profile
            user.role = "customer"
            user.status = "NEW"
          }
          return true
        } catch (error) {
          console.error("SignIn error:", error)
          return true // Still allow sign-in, jwt callback will handle status
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

      // For Google sign-in, check if user exists in database
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
          // New user - needs to complete registration
          token.role = "customer"
          token.status = "NEW"
        }
      }

      // Refresh customer status on session update
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
      // Allow frontend URLs (localhost:5173)
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:5173"

      // If URL is from frontend, allow it
      if (url.startsWith(frontendUrl)) {
        return url
      }

      // Handle relative URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`
      }

      // If URL is from backend, allow it
      if (url.startsWith(baseUrl)) {
        return url
      }

      // Default to frontend customer dashboard for Google sign-in
      return `${frontendUrl}/customer/dashboard`
    }
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}

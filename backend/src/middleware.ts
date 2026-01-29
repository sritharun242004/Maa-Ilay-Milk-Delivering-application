import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Redirect based on role
    if (token) {
      const role = token.role

      // Customer routes
      if (path.startsWith("/customer")) {
        if (role !== "customer") {
          return NextResponse.redirect(new URL(`/${role}`, req.url))
        }
        // Check if customer needs to complete registration
        if (token.status === "NEW" && !path.startsWith("/customer/register")) {
          return NextResponse.redirect(new URL("/customer/register", req.url))
        }
      }

      // Admin routes
      if (path.startsWith("/admin")) {
        if (role !== "admin") {
          return NextResponse.redirect(new URL(`/${role === "customer" ? "customer" : "delivery"}`, req.url))
        }
      }

      // Delivery person routes
      if (path.startsWith("/delivery")) {
        if (role !== "delivery") {
          return NextResponse.redirect(new URL(`/${role === "customer" ? "customer" : "admin"}`, req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // Public routes that don't need auth
        const publicRoutes = [
          "/",
          "/login",
          "/login/customer",
          "/login/admin",
          "/login/delivery",
          "/api/auth",
          "/api/webhooks",
        ]

        // Check if current path is public
        const isPublicRoute = publicRoutes.some(route => 
          path === route || path.startsWith(route + "/")
        )

        if (isPublicRoute) {
          return true
        }

        // Protected routes need token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}

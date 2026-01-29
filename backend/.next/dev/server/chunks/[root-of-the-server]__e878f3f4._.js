module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[project]/src/lib/prisma.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$neon$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@prisma/adapter-neon/dist/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$neondatabase$2f$serverless$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@neondatabase/serverless/index.mjs [app-route] (ecmascript)");
;
;
;
// Configure WebSocket for non-edge environments
if (typeof globalThis.WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$neondatabase$2f$serverless$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["neonConfig"].webSocketConstructor = __turbopack_context__.r("[project]/node_modules/ws/index.js [app-route] (ecmascript)");
}
const globalForPrisma = globalThis;
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    const adapter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$neon$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PrismaNeon"]({
        connectionString
    });
    return new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
        adapter,
        log: ("TURBOPACK compile-time truthy", 1) ? [
            'error',
            'warn'
        ] : "TURBOPACK unreachable"
    });
}
const prisma = globalForPrisma.prisma ?? createPrismaClient();
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = prisma;
const __TURBOPACK__default__export__ = prisma;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/assert [external] (assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("assert", () => require("assert"));

module.exports = mod;
}),
"[externals]/querystring [external] (querystring, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("querystring", () => require("querystring"));

module.exports = mod;
}),
"[project]/src/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authOptions",
    ()=>authOptions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$google$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/providers/google.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$credentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/providers/credentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/bcryptjs/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
;
;
;
;
const authOptions = {
    providers: [
        // Google OAuth for Customers
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$google$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        // Credentials for Admin
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$credentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])({
            id: "admin-credentials",
            name: "Admin Login",
            credentials: {
                email: {
                    label: "Email",
                    type: "email"
                },
                password: {
                    label: "Password",
                    type: "password"
                }
            },
            async authorize (credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }
                const admin = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].admin.findUnique({
                    where: {
                        email: credentials.email
                    }
                });
                if (!admin || !admin.isActive) {
                    throw new Error("Invalid credentials or account disabled");
                }
                const isValid = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].compare(credentials.password, admin.password);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }
                // Update last login
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].admin.update({
                    where: {
                        id: admin.id
                    },
                    data: {
                        lastLoginAt: new Date()
                    }
                });
                return {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    role: "admin"
                };
            }
        }),
        // Credentials for Delivery Person
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$credentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])({
            id: "delivery-credentials",
            name: "Delivery Login",
            credentials: {
                phone: {
                    label: "Phone Number",
                    type: "text"
                },
                password: {
                    label: "Password",
                    type: "password"
                }
            },
            async authorize (credentials) {
                if (!credentials?.phone || !credentials?.password) {
                    throw new Error("Phone number and password are required");
                }
                // Clean phone number (remove spaces, dashes, country code)
                const phone = credentials.phone.replace(/\D/g, '').slice(-10);
                const deliveryPerson = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].deliveryPerson.findUnique({
                    where: {
                        phone
                    }
                });
                if (!deliveryPerson || !deliveryPerson.isActive) {
                    throw new Error("Invalid credentials or account disabled");
                }
                const isValid = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].compare(credentials.password, deliveryPerson.password);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }
                // Update last login
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].deliveryPerson.update({
                    where: {
                        id: deliveryPerson.id
                    },
                    data: {
                        lastLoginAt: new Date()
                    }
                });
                return {
                    id: deliveryPerson.id,
                    name: deliveryPerson.name,
                    phone: deliveryPerson.phone,
                    role: "delivery"
                };
            }
        })
    ],
    callbacks: {
        async signIn ({ user, account }) {
            // For Google sign-in (customers)
            if (account?.provider === "google") {
                try {
                    // Check if customer exists
                    const existingCustomer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.findUnique({
                        where: {
                            email: user.email
                        }
                    });
                    if (existingCustomer) {
                        // Update role info for existing customer
                        user.role = "customer";
                        user.id = existingCustomer.id;
                        user.status = existingCustomer.status;
                    } else {
                        // New customer - will need to complete profile
                        user.role = "customer";
                        user.status = "NEW";
                    }
                    return true;
                } catch (error) {
                    console.error("SignIn error:", error);
                    return true // Still allow sign-in, jwt callback will handle status
                    ;
                }
            }
            return true;
        },
        async jwt ({ token, user, account, trigger }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.phone = user.phone;
                token.status = user.status;
            }
            // For Google sign-in, check if user exists in database
            if (account?.provider === "google" && token.email) {
                const customer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.findUnique({
                    where: {
                        email: token.email
                    }
                });
                if (customer) {
                    token.id = customer.id;
                    token.role = "customer";
                    token.status = customer.status;
                    token.phone = customer.phone;
                } else {
                    // New user - needs to complete registration
                    token.role = "customer";
                    token.status = "NEW";
                }
            }
            // Refresh customer status on session update
            if (trigger === "update" && token.role === "customer" && token.id) {
                const customer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.findUnique({
                    where: {
                        id: token.id
                    }
                });
                if (customer) {
                    token.status = customer.status;
                }
            }
            return token;
        },
        async session ({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.phone = token.phone;
                session.user.status = token.status;
            }
            return session;
        },
        async redirect ({ url, baseUrl }) {
            // Handle callback URLs properly
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`;
            }
            if (url.startsWith(baseUrl)) {
                return url;
            }
            // Default to customer dashboard for Google sign-in
            return `${baseUrl}/customer`;
        }
    },
    pages: {
        signIn: "/login",
        error: "/login"
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60
    },
    secret: process.env.NEXTAUTH_SECRET
};
}),
"[project]/src/lib/api-utils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "errorResponse",
    ()=>errorResponse,
    "getSession",
    ()=>getSession,
    "requireAdmin",
    ()=>requireAdmin,
    "requireAuth",
    ()=>requireAuth,
    "requireCustomer",
    ()=>requireCustomer,
    "requireDelivery",
    ()=>requireDelivery,
    "successResponse",
    ()=>successResponse,
    "validationError",
    ()=>validationError,
    "verifyCronSecret",
    ()=>verifyCronSecret
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
;
;
;
function successResponse(data, status = 200) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true,
        data
    }, {
        status
    });
}
function errorResponse(message, status = 400) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: false,
        error: message
    }, {
        status
    });
}
function validationError(error) {
    const messages = error.errors.map((e)=>e.message).join(", ");
    return errorResponse(messages, 400);
}
async function getSession() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
}
async function requireAuth(allowedRoles) {
    const session = await getSession();
    if (!session?.user) {
        return {
            error: errorResponse("Unauthorized", 401),
            session: null
        };
    }
    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
        return {
            error: errorResponse("Forbidden", 403),
            session: null
        };
    }
    return {
        error: null,
        session
    };
}
async function requireAdmin() {
    return requireAuth([
        "admin"
    ]);
}
async function requireDelivery() {
    return requireAuth([
        "delivery"
    ]);
}
async function requireCustomer() {
    return requireAuth([
        "customer"
    ]);
}
function verifyCronSecret(request) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error("CRON_SECRET not configured");
        return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
}
}),
"[project]/src/app/api/admin/customers/[id]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "PATCH",
    ()=>PATCH
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api-utils.ts [app-route] (ecmascript)");
;
;
async function GET(request, { params }) {
    try {
        const { error, session } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["requireAdmin"])();
        if (error) return error;
        const { id } = await params;
        const customer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.findUnique({
            where: {
                id
            },
            include: {
                subscription: true,
                wallet: {
                    include: {
                        transactions: {
                            orderBy: {
                                createdAt: "desc"
                            },
                            take: 50
                        }
                    }
                },
                deliveryPerson: true,
                deliveries: {
                    orderBy: {
                        deliveryDate: "desc"
                    },
                    take: 30
                },
                pauses: {
                    orderBy: {
                        pauseDate: "desc"
                    },
                    take: 30
                },
                bottleLedger: {
                    orderBy: {
                        createdAt: "desc"
                    },
                    take: 50
                }
            }
        });
        if (!customer) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["errorResponse"])("Customer not found", 404);
        }
        // Calculate bottle balance
        const latestBottleEntry = customer.bottleLedger[0];
        const bottleBalance = {
            large: latestBottleEntry?.largeBottleBalanceAfter ?? 0,
            small: latestBottleEntry?.smallBottleBalanceAfter ?? 0
        };
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["successResponse"])({
            customer,
            bottleBalance
        });
    } catch (err) {
        console.error("Get customer error:", err);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["errorResponse"])("Failed to fetch customer", 500);
    }
}
async function PATCH(request, { params }) {
    try {
        const { error, session } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["requireAdmin"])();
        if (error) return error;
        const { id } = await params;
        const body = await request.json();
        const { name, phone, addressLine1, addressLine2, landmark, city, pincode, deliveryPersonId, deliveryNotes, status } = body;
        // Get current customer for audit
        const currentCustomer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.findUnique({
            where: {
                id
            }
        });
        if (!currentCustomer) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["errorResponse"])("Customer not found", 404);
        }
        // Update customer
        const customer = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].customer.update({
            where: {
                id
            },
            data: {
                ...name && {
                    name
                },
                ...phone && {
                    phone
                },
                ...addressLine1 && {
                    addressLine1
                },
                ...addressLine2 !== undefined && {
                    addressLine2
                },
                ...landmark !== undefined && {
                    landmark
                },
                ...city && {
                    city
                },
                ...pincode && {
                    pincode
                },
                ...deliveryPersonId && {
                    deliveryPersonId
                },
                ...deliveryNotes !== undefined && {
                    deliveryNotes
                },
                ...status && {
                    status
                }
            }
        });
        // Create audit log
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].adminAuditLog.create({
            data: {
                adminId: session.user.id,
                action: "customer_updated",
                entityType: "customer",
                entityId: id,
                oldValue: currentCustomer,
                newValue: customer
            }
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["successResponse"])({
            customer
        });
    } catch (err) {
        console.error("Update customer error:", err);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$utils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["errorResponse"])("Failed to update customer", 500);
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e878f3f4._.js.map
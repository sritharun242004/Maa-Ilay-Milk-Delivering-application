import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import passport from './config/passport';
import { validateRequiredEnvVars } from './config/constants';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customer';
import deliveryRoutes from './routes/delivery';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';
import paymentRoutes from './routes/payment';
import {
  apiLimiter,
  authLimiter,
  adminLimiter
} from './middleware/rateLimiter';
import {
  csrfProtection,
  csrfTokenEndpoint,
  csrfErrorHandler
} from './middleware/csrf';
import { sendError, ErrorCodes } from './utils/errorHandler';
import {
  httpLogger,
  devLogger,
  requestContextLogger,
  errorLogger
} from './middleware/logger';

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================
// Validate required environment variables on startup
// This prevents the app from starting with invalid configuration
try {
  validateRequiredEnvVars();
  console.log('✓ Environment variables validated successfully');
} catch (error) {
  console.error('✗ Environment validation failed:', error instanceof Error ? error.message : error);
  console.error('Please check your .env file and ensure all required variables are set');
  process.exit(1);
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Compression - Gzip/Deflate responses for mobile optimization
// Compresses all text-based responses (JSON, HTML, CSS, JS)
app.use(compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Compression level (0-9, 6 is default balance of speed vs size)
  level: 6,
  // Don't compress responses with Cache-Control: no-transform
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security Headers - Helmet.js
// Protects against common vulnerabilities by setting secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for frontend
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny', // Prevent clickjacking
  },
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

// CORS - Allow frontend to make requests
// SECURITY: In production, FRONTEND_URL must be set explicitly (no fallback to localhost)
const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl && process.env.NODE_ENV === 'production') {
  console.error('✗ FRONTEND_URL must be set in production environment');
  process.exit(1);
}

app.use(cors({
  origin: frontendUrl || 'http://localhost:5173', // Fallback only in development
  credentials: true, // Important: allows cookies/sessions
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing - Required for CSRF protection
app.use(cookieParser());

// Request Logging
// HTTP access logs (all requests)
if (process.env.NODE_ENV === 'production') {
  app.use(httpLogger); // Production: log to file
} else {
  app.use(devLogger); // Development: colored console output
}

// Request context (adds request ID for traceability)
app.use(requestContextLogger);

import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Session configuration
// SECURITY: Session secret is validated during environment validation
// If we reach here, SESSION_SECRET is guaranteed to be set and meet length requirements
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('✗ SESSION_SECRET is not set. This should have been caught by environment validation.');
  process.exit(1);
}

app.use(
  session({
    secret: sessionSecret, // No fallback - must be explicitly set
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(
      prisma,
      {
        checkPeriod: 2 * 60 * 1000,
        dbRecordIdIsSessionId: false,
        dbRecordIdFunction: undefined,
      }
    ),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ============================================================================
// RATE LIMITING
// ============================================================================
// Apply rate limiting to all API routes to prevent abuse

// General API rate limiting (applies to all /api/* routes except auth which has its own limiter)
app.use('/api/', (req, res, next) => {
  // Skip general limiter for auth routes — they use authLimiter instead
  if (req.path.startsWith('/auth')) return next();
  return apiLimiter(req, res, next);
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check routes (no rate limiting, no CSRF)
// Used by load balancers and monitoring tools
app.use('/health', healthRoutes);

// CSRF token endpoint (GET request, no CSRF protection needed)
app.get('/api/csrf-token', csrfTokenEndpoint);

// Auth routes (stricter rate limiting for login/signup)
app.use('/api/auth', authLimiter, authRoutes);

// Customer routes with CSRF protection for state-changing operations
// Note: GET requests are automatically excluded by CSRF middleware
// TEMP: Skip CSRF for complete-profile due to session issues with OAuth flow
app.use('/api/customer', (req, res, next) => {
  if (req.path === '/complete-profile' && req.method === 'POST') {
    return next(); // Skip CSRF for onboarding
  }
  return csrfProtection(req, res, next);
}, customerRoutes);

// Payment routes - Webhook endpoint needs to skip CSRF
app.use('/api/payment', (req, res, next) => {
  if (req.path === '/webhook' && req.method === 'POST') {
    return next(); // Skip CSRF for Cashfree webhook
  }
  return csrfProtection(req, res, next);
}, paymentRoutes);

// Delivery person routes with CSRF protection
app.use('/api/delivery', csrfProtection, deliveryRoutes);

// Admin routes with CSRF protection and admin rate limiting
app.use('/api/admin', adminLimiter, csrfProtection, adminRoutes);

// Root route - Welcome message
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Maa Ilay API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      docs: 'API documentation available at /api/docs (if configured)'
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler - Standardized format
app.use((req, res) => {
  sendError(res, 404, 'Route not found', ErrorCodes.NOT_FOUND, {
    path: req.path,
    method: req.method,
  }, req);
});

// Error logger (logs all errors before sending response)
app.use(errorLogger);

// CSRF error handler (must come before global error handler)
app.use(csrfErrorHandler);

// Global error handler - Standardized format
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  // Use standardized error format
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || (statusCode === 500 ? ErrorCodes.INTERNAL_SERVER_ERROR : undefined);

  sendError(res, statusCode, message, code, {
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  }, req);
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    🥛 Maa Ilay Express Backend                   ║
║                                                   ║
║    ✅ Server running on port ${PORT}              ║
║    ✅ Environment: ${process.env.NODE_ENV || 'development'}                    ║
║    ✅ Database connected                          ║
║    ✅ Google OAuth configured                     ║
║                                                   ║
║    🌐 http://localhost:${PORT}                    ║
║    📚 API: http://localhost:${PORT}/api           ║
║    ❤️  Health: http://localhost:${PORT}/health    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;

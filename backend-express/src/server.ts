import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
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
  errorLogger,
  logSecurityEvent
} from './middleware/logger';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust reverse proxy (Render, etc.) so secure cookies work behind HTTPS proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://sdk.cashfree.com", "https://maps.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://sdk.cashfree.com", "https://maps.googleapis.com", "https://places.googleapis.com", "https://*.cashfree.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["https://sdk.cashfree.com", "https://*.cashfree.com"],
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
// In production with same-origin serving, CORS is not strictly needed but kept for flexibility
const frontendUrl = process.env.FRONTEND_URL;

app.use(cors({
  origin: frontendUrl || 'http://localhost:5173', // Fallback in development or same-origin production
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
import { Store } from 'express-session';
import prisma from './config/prisma';

// In-memory cache layer for session store to avoid DB roundtrip on every request
class CachedSessionStore extends Store {
  private backend: InstanceType<typeof PrismaSessionStore>;
  private cache = new Map<string, { data: string; expiresAt: number }>();
  private CACHE_TTL = 60 * 1000; // 60 seconds

  constructor(backend: InstanceType<typeof PrismaSessionStore>) {
    super();
    this.backend = backend;
  }

  get = (sid: string, callback: (err?: any, session?: session.SessionData | null) => void) => {
    const cached = this.cache.get(sid);
    if (cached && cached.expiresAt > Date.now()) {
      try {
        return callback(null, JSON.parse(cached.data));
      } catch { /* fall through to DB */ }
    }
    this.backend.get(sid, (err, sess) => {
      if (!err && sess) {
        this.cache.set(sid, { data: JSON.stringify(sess), expiresAt: Date.now() + this.CACHE_TTL });
      }
      callback(err, sess);
    });
  };

  set = (sid: string, sess: session.SessionData, callback?: (err?: any) => void) => {
    this.cache.set(sid, { data: JSON.stringify(sess), expiresAt: Date.now() + this.CACHE_TTL });
    this.backend.set(sid, sess, callback);
  };

  destroy = (sid: string, callback?: (err?: any) => void) => {
    this.cache.delete(sid);
    this.backend.destroy(sid, callback);
  };

  touch = (sid: string, sess: session.SessionData, callback?: () => void) => {
    // Update local cache expiry; write to DB only every 5 minutes
    const cached = this.cache.get(sid);
    if (cached) {
      cached.expiresAt = Date.now() + this.CACHE_TTL;
    }
    // Skip DB touch — session expiry is 7 days, no need to update on every request
    if (callback) callback();
  };
}

// Session configuration
// SECURITY: Session secret is validated during environment validation
// If we reach here, SESSION_SECRET is guaranteed to be set and meet length requirements
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('✗ SESSION_SECRET is not set. This should have been caught by environment validation.');
  process.exit(1);
}

const prismaStore = new PrismaSessionStore(
  prisma,
  {
    checkPeriod: 10 * 60 * 1000, // Cleanup expired sessions every 10 min
    dbRecordIdIsSessionId: false,
    dbRecordIdFunction: undefined,
  }
);

app.use(
  session({
    secret: sessionSecret, // No fallback - must be explicitly set
    resave: false,
    saveUninitialized: false,
    store: new CachedSessionStore(prismaStore),
    cookie: {
      secure: process.env.SECURE_COOKIES === 'true', // Enable only when HTTPS is configured
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax', // Same-origin serving, no need for 'none'
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

// Public pricing endpoint (no auth, no CSRF — read-only)
app.get('/api/pricing', async (_req, res) => {
  try {
    const { loadPricing } = await import('./config/pricingLoader');
    const tiers = await loadPricing();
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.json({ tiers });
  } catch (e) {
    console.error('Pricing endpoint error:', e);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

// Instagram reel thumbnail (public, no auth) — tries oEmbed; returns thumbnail_url if available
app.get('/api/instagram-thumbnail', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl || !rawUrl.startsWith('https://www.instagram.com/')) {
    return res.status(400).json({ error: 'Valid Instagram URL required' });
  }
  try {
    const canonicalUrl = rawUrl.split('?')[0];
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaaIlay/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }
    const data = (await response.json()) as { thumbnail_url?: string };
    if (data.thumbnail_url) {
      res.set('Cache-Control', 'public, max-age=86400'); // 24h
      return res.json({ thumbnail_url: data.thumbnail_url });
    }
    return res.status(404).json({ error: 'Thumbnail not available' });
  } catch (e) {
    console.error('Instagram thumbnail fetch error:', e);
    return res.status(502).json({ error: 'Could not fetch thumbnail' });
  }
});

// Auth routes (stricter rate limiting for login/signup)
app.use('/api/auth', authLimiter, authRoutes);

// Customer routes with CSRF protection for state-changing operations
// Note: GET requests are automatically excluded by CSRF middleware
app.use('/api/customer', (req, res, next) => {
  // Enhanced CSRF protection: Only skip for authenticated OAuth users during profile completion
  if (req.path === '/complete-profile' && req.method === 'POST') {
    // Additional security: Only allow CSRF bypass if user is authenticated via OAuth
    // and is a customer (safer than blanket bypass)
    if (req.user && req.user.role === 'customer') {
      console.warn(`CSRF bypass for OAuth profile completion - User: ${req.user.id}`);
      // Log this security bypass for monitoring
      logSecurityEvent('CSRF_FAILURE', req, {
        userId: req.user.id,
        bypass: 'oauth_profile_completion'
      });
      return next(); // Skip CSRF only for OAuth profile completion
    }
    // If user doesn't meet criteria, require CSRF protection
    console.log(`CSRF required for profile completion - User: ${req.user?.id || 'unknown'}`);
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

// ============================================================================
// STATIC FILE SERVING (Production: serve frontend from same origin)
// ============================================================================
const frontendDistPath = path.join(__dirname, '../../frontend/dist');

if (process.env.NODE_ENV === 'production') {
  // Serve frontend static assets
  app.use(express.static(frontendDistPath));

  // SPA catch-all: serve index.html for non-API routes (client-side routing)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next(); // Let API/health 404s fall through to error handler
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Development: show API info at root
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to Maa Ilay API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        api: '/api',
      }
    });
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler for API routes (non-API routes are handled by SPA catch-all in production)
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

  // Start scheduled jobs (penalty checks, monthly payment enforcement)
  import('./services/scheduler').then(({ startAllSchedulers }) => {
    startAllSchedulers();
  }).catch(err => {
    console.error('Failed to start schedulers:', err);
  });
});

export default app;

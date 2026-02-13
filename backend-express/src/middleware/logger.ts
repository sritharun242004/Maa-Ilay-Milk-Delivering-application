import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

/**
 * Request Logging Middleware
 *
 * Features:
 * - HTTP request logging (morgan)
 * - Audit trail for sensitive operations
 * - Security event logging
 * - Error logging
 */

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for different log types
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

const auditLogStream = fs.createWriteStream(
  path.join(logsDir, 'audit.log'),
  { flags: 'a' }
);

const securityLogStream = fs.createWriteStream(
  path.join(logsDir, 'security.log'),
  { flags: 'a' }
);

/**
 * Morgan HTTP request logger
 * Logs all HTTP requests with detailed information
 */
export const httpLogger = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  {
    stream: accessLogStream,
  }
);

/**
 * Console logger for development
 * Colored output for better readability
 */
export const devLogger = morgan('dev');

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  timestamp: string;
  requestId?: string;
  userId?: string;
  userRole?: string;
  action: string;
  resource: string;
  details?: any;
  ip: string;
  userAgent?: string;
  success: boolean;
  error?: string;
}

/**
 * Log audit trail for sensitive operations
 */
export function logAudit(
  req: Request,
  action: string,
  resource: string,
  success: boolean,
  details?: any,
  error?: string
): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId,
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
    action,
    resource,
    details,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent'),
    success,
    error,
  };

  // Write to audit log file
  auditLogStream.write(JSON.stringify(entry) + '\n');

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUDIT][${entry.requestId}]`, entry);
  }
}

/**
 * Log security events (failed auth, rate limiting, CSRF failures, etc.)
 */
export function logSecurityEvent(
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'CSRF_FAILURE' | 'SUSPICIOUS_ACTIVITY' | 'ACCESS_DENIED',
  req: Request,
  details?: any
): void {
  const requestId = (req as any).requestId;
  const entry = {
    timestamp: new Date().toISOString(),
    requestId,
    type,
    userId: (req as any).user?.id,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent'),
    url: req.originalUrl,
    method: req.method,
    details,
  };

  // Write to security log file
  securityLogStream.write(JSON.stringify(entry) + '\n');

  // Also log to console
  console.warn(`[SECURITY][${requestId}]`, entry);
}

/**
 * Middleware to automatically log sensitive operations
 * Attach this to routes that need audit logging
 */
export function auditMiddleware(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function (data: any): Response {
      // Log audit trail
      const success = res.statusCode >= 200 && res.statusCode < 400;
      logAudit(
        req,
        action,
        resource,
        success,
        {
          method: req.method,
          url: req.originalUrl,
          body: req.body,
          statusCode: res.statusCode,
        },
        success ? undefined : 'Request failed'
      );

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Error logger middleware
 * Logs all errors that occur during request processing
 */
export function errorLogger(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId;
  const errorEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    userId: (req as any).user?.id,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    },
  };

  // Write to audit log (errors are important for audit)
  auditLogStream.write(JSON.stringify({ ...errorEntry, type: 'ERROR' }) + '\n');

  // Log to console
  console.error(`[ERROR][${requestId}]`, errorEntry);

  // Pass to next error handler
  next(err);
}

/**
 * Request context logger
 * Adds request ID to all logs for better traceability
 */
export function requestContextLogger(req: Request, res: Response, next: NextFunction): void {
  // Check if request ID already exists (from load balancer or proxy)
  let requestId = req.get('X-Request-ID') || req.get('X-Correlation-ID');

  // Generate lightweight random ID if no request ID provided
  if (!requestId) {
    requestId = randomBytes(8).toString('hex');
  }

  // Store request ID on request object for use in other middleware/routes
  (req as any).requestId = requestId;

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log request start with request ID
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} - Started`);
  }

  // Log response when finished
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'production') {
      const duration = Date.now() - (req as any).startTime;
      console.log(`[${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${res.get('content-length') || 0} bytes) ${duration}ms`);
    }
  });

  // Store start time for duration calculation
  (req as any).startTime = Date.now();

  next();
}

/**
 * Sensitive operations that should always be logged
 */
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Customer management
  CUSTOMER_CREATE: 'CUSTOMER_CREATE',
  CUSTOMER_UPDATE: 'CUSTOMER_UPDATE',
  CUSTOMER_DELETE: 'CUSTOMER_DELETE',
  CUSTOMER_APPROVE: 'CUSTOMER_APPROVE',

  // Subscription
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATE',
  SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATE',
  SUBSCRIPTION_CANCEL: 'SUBSCRIPTION_CANCEL',

  // Delivery
  DELIVERY_MARK: 'DELIVERY_MARK',
  DELIVERY_UPDATE: 'DELIVERY_UPDATE',

  // Wallet
  WALLET_TOPUP: 'WALLET_TOPUP',
  WALLET_CHARGE: 'WALLET_CHARGE',
  WALLET_REFUND: 'WALLET_REFUND',

  // Admin operations
  ADMIN_ACTION: 'ADMIN_ACTION',
  DELIVERY_PERSON_CREATE: 'DELIVERY_PERSON_CREATE',
  DELIVERY_PERSON_UPDATE: 'DELIVERY_PERSON_UPDATE',
  DELIVERY_PERSON_DELETE: 'DELIVERY_PERSON_DELETE',

  // Bottle management
  BOTTLE_ISSUE: 'BOTTLE_ISSUE',
  BOTTLE_COLLECT: 'BOTTLE_COLLECT',
  BOTTLE_PENALTY: 'BOTTLE_PENALTY',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

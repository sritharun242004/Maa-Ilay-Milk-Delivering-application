import { doubleCsrf } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCodes } from '../utils/errorHandler';
import { logSecurityEvent } from './logger';

// Extend express-session types to include custom properties
declare module 'express-session' {
  interface SessionData {
    csrfInitialized?: boolean;
  }
}

/**
 * CSRF Protection Middleware for Maa Ilay API
 *
 * Uses double-submit cookie pattern to prevent CSRF attacks
 * on state-changing operations (POST, PUT, PATCH, DELETE)
 */

const csrfConfig = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production',
  cookieName: 'maa-ilay.csrf', // Changed from __Host- to allow localhost
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Lax for dev
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64, // Token size
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Don't check CSRF for read-only methods
  getSessionIdentifier: (req: Request) => {
    // Use session ID as identifier, with better fallback
    // In production, this should always have a session
    const sessionId = (req.session as any)?.id || req.sessionID;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const identifier = sessionId || `temp-${ip}`;

    return identifier;
  },
});

const doubleCsrfProtection = csrfConfig.doubleCsrfProtection;

/**
 * Endpoint to get CSRF token
 * Frontend should call this before making state-changing requests
 */
export const csrfTokenEndpoint = (req: Request, res: Response) => {
  try {
    // Ensure session exists by setting a value if it doesn't exist
    if (!req.session.csrfInitialized) {
      req.session.csrfInitialized = true;

      // Explicitly save the session to ensure it's persisted
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
      });
    }

    const csrfToken = csrfConfig.generateCsrfToken(req, res, { overwrite: true });
    res.json({ csrfToken });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    // Generate a simple token as fallback
    try {
      const csrfToken = csrfConfig.generateCsrfToken(req, res);
      res.json({ csrfToken });
    } catch (fallbackError) {
      console.error('CSRF token generation fallback error:', fallbackError);
      res.status(500).json({ error: 'Failed to generate CSRF token', csrfToken: null });
    }
  }
};

/**
 * CSRF protection middleware
 * Apply to routes that need protection
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Custom error handler for CSRF errors
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF') || err.message?.includes('csrf')) {
    console.warn(`CSRF token validation failed from IP: ${req.ip}`);

    // Log security event
    logSecurityEvent('CSRF_FAILURE', req, {
      error: err.message,
    });

    sendError(
      res,
      403,
      'Invalid CSRF token. Please refresh the page and try again.',
      ErrorCodes.CSRF_VALIDATION_FAILED,
      {
        path: req.path,
        method: req.method,
      },
      req
    );
  } else {
    next(err);
  }
};

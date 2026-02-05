import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendError, ErrorCodes } from '../utils/errorHandler';
import { logSecurityEvent } from './logger';
import { RATE_LIMITS } from '../config/constants';

/**
 * Rate Limiting Middleware for Maa Ilay API
 *
 * Protects against:
 * - Brute force attacks
 * - DOS attacks
 * - API abuse
 */

// Standard rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.WINDOW_MS,
  max: RATE_LIMITS.API.MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: RATE_LIMITS.API.WINDOW_NAME
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for successful requests to avoid penalizing normal users
  skipSuccessfulRequests: false,
  // Handler for when limit is exceeded
  handler: (req: Request, res: Response) => {
    logSecurityEvent('RATE_LIMIT', req, {
      limiter: 'apiLimiter',
      limit: RATE_LIMITS.API.MAX_REQUESTS,
      window: RATE_LIMITS.API.WINDOW_NAME,
    });
    sendError(
      res,
      429,
      'Too many requests from this IP, please try again later.',
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter: RATE_LIMITS.API.WINDOW_NAME },
      req
    );
  }
});

// Strict limiter for authentication endpoints (login, signup)
export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.WINDOW_MS,
  max: RATE_LIMITS.AUTH.MAX_REQUESTS,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: RATE_LIMITS.AUTH.WINDOW_NAME
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req: Request, res: Response) => {
    console.warn(`Rate limit exceeded for auth from IP: ${req.ip}`);
    logSecurityEvent('RATE_LIMIT', req, {
      limiter: 'authLimiter',
      limit: RATE_LIMITS.AUTH.MAX_REQUESTS,
      window: RATE_LIMITS.AUTH.WINDOW_NAME,
    });
    sendError(
      res,
      429,
      'Too many authentication attempts. Please try again later.',
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter: RATE_LIMITS.AUTH.WINDOW_NAME },
      req
    );
  }
});

// Very strict limiter for password reset endpoints
export const passwordResetLimiter = rateLimit({
  windowMs: RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  message: {
    error: 'Too many password reset attempts, please try again later.',
    retryAfter: RATE_LIMITS.PASSWORD_RESET.WINDOW_NAME
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`Rate limit exceeded for password reset from IP: ${req.ip}`);
    sendError(
      res,
      429,
      `Too many password reset attempts. Please try again in ${RATE_LIMITS.PASSWORD_RESET.WINDOW_NAME}.`,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter: RATE_LIMITS.PASSWORD_RESET.WINDOW_NAME },
      req
    );
  }
});

// Generous limiter for delivery person marking deliveries (they do this frequently)
export const deliveryActionLimiter = rateLimit({
  windowMs: RATE_LIMITS.DELIVERY_ACTION.WINDOW_MS,
  max: RATE_LIMITS.DELIVERY_ACTION.MAX_REQUESTS,
  message: {
    error: 'You are marking deliveries too quickly. Please slow down.',
    retryAfter: RATE_LIMITS.DELIVERY_ACTION.WINDOW_NAME
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    sendError(
      res,
      429,
      'You are marking deliveries too quickly. Please slow down.',
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter: RATE_LIMITS.DELIVERY_ACTION.WINDOW_NAME },
      req
    );
  }
});

// Moderate limiter for wallet operations (financial transactions)
export const walletLimiter = rateLimit({
  windowMs: RATE_LIMITS.WALLET.WINDOW_MS,
  max: RATE_LIMITS.WALLET.MAX_REQUESTS,
  message: {
    error: 'Too many wallet operations, please try again later.',
    retryAfter: RATE_LIMITS.WALLET.WINDOW_NAME
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`Rate limit exceeded for wallet ops from IP: ${req.ip}`);
    sendError(
      res,
      429,
      'Too many wallet operations. Please try again in a few minutes.',
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter: RATE_LIMITS.WALLET.WINDOW_NAME },
      req
    );
  }
});

// Admin operations limiter (more generous for admins)
export const adminLimiter = rateLimit({
  windowMs: RATE_LIMITS.ADMIN.WINDOW_MS,
  max: RATE_LIMITS.ADMIN.MAX_REQUESTS,
  message: {
    error: 'Too many admin operations, please slow down.',
    retryAfter: RATE_LIMITS.ADMIN.WINDOW_NAME
  },
  standardHeaders: true,
  legacyHeaders: false
});

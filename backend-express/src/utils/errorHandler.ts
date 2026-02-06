import { Request, Response } from 'express';

/**
 * Standardized Error Response Format
 * All API errors should use this consistent structure
 */
export interface ErrorResponse {
  error: string;           // Human-readable error message
  code?: string;          // Machine-readable error code
  requestId?: string;     // Request ID for tracing
  details?: any;          // Additional error details (validation errors, etc.)
  timestamp?: string;     // ISO timestamp when error occurred
}

/**
 * Standard error codes for the application
 */
export const ErrorCodes = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CSRF_VALIDATION_FAILED: 'CSRF_VALIDATION_FAILED',

  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  DELIVERY_NOT_FOUND: 'DELIVERY_NOT_FOUND',

  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_STATUS: 'INVALID_STATUS',

  // Business logic errors (400)
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  PAUSE_CUTOFF_EXCEEDED: 'PAUSE_CUTOFF_EXCEEDED',
  CANNOT_PAUSE_PAST_DATE: 'CANNOT_PAUSE_PAST_DATE',
  BOTTLE_COLLECTION_EXCEEDED: 'BOTTLE_COLLECTION_EXCEEDED',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
} as const;

/**
 * Send standardized error response
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param message - Human-readable error message
 * @param code - Machine-readable error code
 * @param details - Additional error details
 * @param req - Optional request object (for request ID)
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code?: string,
  details?: any,
  req?: Request
): void {
  const requestId = req ? (req as any).requestId : undefined;

  const response: ErrorResponse = {
    error: message,
    ...(code && { code }),
    ...(requestId && { requestId }),
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}

/**
 * Common error response helpers
 */
export const ErrorResponses = {
  // 400 Bad Request
  badRequest: (res: Response, message: string, details?: any) => {
    sendError(res, 400, message, ErrorCodes.VALIDATION_ERROR, details);
  },

  invalidInput: (res: Response, message: string, details?: any) => {
    sendError(res, 400, message, ErrorCodes.INVALID_INPUT, details);
  },

  missingField: (res: Response, field: string) => {
    sendError(res, 400, `${field} is required`, ErrorCodes.MISSING_REQUIRED_FIELD, { field });
  },

  // 401 Unauthorized
  unauthorized: (res: Response, message: string = 'Unauthorized') => {
    sendError(res, 401, message, ErrorCodes.UNAUTHORIZED);
  },

  invalidCredentials: (res: Response) => {
    sendError(res, 401, 'Invalid email or password', ErrorCodes.INVALID_CREDENTIALS);
  },

  sessionExpired: (res: Response) => {
    sendError(res, 401, 'Session expired. Please login again.', ErrorCodes.SESSION_EXPIRED);
  },

  // 403 Forbidden
  forbidden: (res: Response, message: string = 'Access denied') => {
    sendError(res, 403, message, ErrorCodes.FORBIDDEN);
  },

  insufficientPermissions: (res: Response) => {
    sendError(res, 403, 'You do not have permission to perform this action', ErrorCodes.INSUFFICIENT_PERMISSIONS);
  },

  // 404 Not Found
  notFound: (res: Response, resource: string = 'Resource') => {
    sendError(res, 404, `${resource} not found`, ErrorCodes.NOT_FOUND);
  },

  customerNotFound: (res: Response) => {
    sendError(res, 404, 'Customer not found', ErrorCodes.CUSTOMER_NOT_FOUND);
  },

  deliveryNotFound: (res: Response) => {
    sendError(res, 404, 'Delivery not found', ErrorCodes.DELIVERY_NOT_FOUND);
  },

  // 429 Rate Limit
  rateLimitExceeded: (res: Response, retryAfter: string) => {
    sendError(
      res,
      429,
      'Too many requests. Please try again later.',
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      { retryAfter }
    );
  },

  // 500 Internal Server Error
  serverError: (res: Response, message: string = 'Internal server error') => {
    sendError(res, 500, message, ErrorCodes.INTERNAL_SERVER_ERROR);
  },

  databaseError: (res: Response) => {
    sendError(res, 500, 'Database operation failed', ErrorCodes.DATABASE_ERROR);
  },

  transactionFailed: (res: Response) => {
    sendError(res, 500, 'Transaction failed. Please try again.', ErrorCodes.TRANSACTION_FAILED);
  },
};

/**
 * Validation error helper - formats validation errors consistently
 */
export function validationError(res: Response, errors: Array<{ field: string; message: string }>) {
  sendError(
    res,
    400,
    'Validation failed',
    ErrorCodes.VALIDATION_ERROR,
    { errors }
  );
}

/**
 * Business logic error helper
 */
export function businessLogicError(res: Response, message: string, code: string, details?: any, req?: Request) {
  sendError(res, 400, message, code, details, req);
}

/**
 * Extract request ID from request for logging and error responses
 */
export function getRequestId(req: Request): string | undefined {
  return (req as any).requestId;
}

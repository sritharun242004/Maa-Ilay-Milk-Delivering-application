/**
 * Centralized Error Codes for Maa Ilay API
 *
 * Use these error codes for consistent error handling across the application
 */

export enum ErrorCode {
  // Authentication & Authorization (1000-1099)
  UNAUTHORIZED = 'AUTH_001',
  FORBIDDEN = 'AUTH_002',
  INVALID_CREDENTIALS = 'AUTH_003',
  SESSION_EXPIRED = 'AUTH_004',
  CSRF_TOKEN_INVALID = 'AUTH_005',

  // User & Customer (1100-1199)
  CUSTOMER_NOT_FOUND = 'CUST_001',
  CUSTOMER_ALREADY_EXISTS = 'CUST_002',
  PROFILE_INCOMPLETE = 'CUST_003',
  INVALID_STATUS_TRANSITION = 'CUST_004',

  // Subscription (1200-1299)
  SUBSCRIPTION_NOT_FOUND = 'SUB_001',
  SUBSCRIPTION_ALREADY_EXISTS = 'SUB_002',
  INVALID_QUANTITY = 'SUB_003',
  NO_DELIVERY_PERSON_ASSIGNED = 'SUB_004',

  // Wallet & Payments (1300-1399)
  INSUFFICIENT_BALANCE = 'WAL_001',
  WALLET_NOT_FOUND = 'WAL_002',
  PAYMENT_FAILED = 'WAL_003',
  INVALID_AMOUNT = 'WAL_004',
  WALLET_BELOW_MINIMUM = 'WAL_005',
  DEPOSIT_CHARGE_FAILED = 'WAL_006',

  // Delivery (1400-1499)
  DELIVERY_NOT_FOUND = 'DEL_001',
  DELIVERY_ALREADY_COMPLETED = 'DEL_002',
  DELIVERY_PAUSED = 'DEL_003',
  INVALID_DELIVERY_STATUS = 'DEL_004',
  CUTOFF_TIME_EXCEEDED = 'DEL_005',
  DELIVERY_START_DATE_INVALID = 'DEL_006',

  // Bottle Management (1500-1599)
  BOTTLE_COLLECTION_EXCEEDS_BALANCE = 'BOT_001',
  INVALID_BOTTLE_QUANTITY = 'BOT_002',
  BOTTLE_LEDGER_ERROR = 'BOT_003',

  // Calendar & Modifications (1600-1699)
  PAUSE_LIMIT_EXCEEDED = 'CAL_001',
  MODIFICATION_NOT_ALLOWED = 'CAL_002',
  INVALID_DATE = 'CAL_003',
  PAST_DATE_NOT_ALLOWED = 'CAL_004',

  // Admin (1700-1799)
  ADMIN_NOT_FOUND = 'ADM_001',
  DELIVERY_PERSON_NOT_FOUND = 'ADM_002',
  DELIVERY_PERSON_ALREADY_EXISTS = 'ADM_003',

  // Validation (1800-1899)
  VALIDATION_ERROR = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  MISSING_REQUIRED_FIELD = 'VAL_003',
  INVALID_PHONE_FORMAT = 'VAL_004',
  INVALID_EMAIL_FORMAT = 'VAL_005',

  // System & Database (1900-1999)
  DATABASE_ERROR = 'SYS_001',
  TRANSACTION_FAILED = 'SYS_002',
  CONCURRENT_MODIFICATION = 'SYS_003',
  RATE_LIMIT_EXCEEDED = 'SYS_004',
  INTERNAL_SERVER_ERROR = 'SYS_005',
}

/**
 * Error response structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any
): ApiError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get user-friendly message for error code
 */
export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    // Auth
    [ErrorCode.UNAUTHORIZED]: 'You must be logged in to perform this action',
    [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action',
    [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password',
    [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again',
    [ErrorCode.CSRF_TOKEN_INVALID]: 'Security token invalid. Please refresh the page',

    // Customer
    [ErrorCode.CUSTOMER_NOT_FOUND]: 'Customer not found',
    [ErrorCode.CUSTOMER_ALREADY_EXISTS]: 'A customer with this email or phone already exists',
    [ErrorCode.PROFILE_INCOMPLETE]: 'Please complete your profile before proceeding',
    [ErrorCode.INVALID_STATUS_TRANSITION]: 'Invalid status transition',

    // Subscription
    [ErrorCode.SUBSCRIPTION_NOT_FOUND]: 'No active subscription found',
    [ErrorCode.SUBSCRIPTION_ALREADY_EXISTS]: 'You already have an active subscription',
    [ErrorCode.INVALID_QUANTITY]: 'Invalid milk quantity. Must be between 500ml and 2500ml',
    [ErrorCode.NO_DELIVERY_PERSON_ASSIGNED]: 'No delivery person assigned. Please wait for admin approval',

    // Wallet
    [ErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient wallet balance',
    [ErrorCode.WALLET_NOT_FOUND]: 'Wallet not found',
    [ErrorCode.PAYMENT_FAILED]: 'Payment failed. Please try again',
    [ErrorCode.INVALID_AMOUNT]: 'Invalid amount. Minimum top-up is ₹10',
    [ErrorCode.WALLET_BELOW_MINIMUM]: 'This transaction would bring your wallet below the allowed minimum',
    [ErrorCode.DEPOSIT_CHARGE_FAILED]: 'Failed to charge bottle deposit',

    // Delivery
    [ErrorCode.DELIVERY_NOT_FOUND]: 'Delivery not found',
    [ErrorCode.DELIVERY_ALREADY_COMPLETED]: 'This delivery has already been completed',
    [ErrorCode.DELIVERY_PAUSED]: 'Delivery is paused for this date',
    [ErrorCode.INVALID_DELIVERY_STATUS]: 'Invalid delivery status',
    [ErrorCode.CUTOFF_TIME_EXCEEDED]: 'Cannot modify tomorrow\'s delivery after 4 PM',
    [ErrorCode.DELIVERY_START_DATE_INVALID]: 'Delivery start date must be today or a future date',

    // Bottles
    [ErrorCode.BOTTLE_COLLECTION_EXCEEDS_BALANCE]: 'Cannot collect more bottles than customer has',
    [ErrorCode.INVALID_BOTTLE_QUANTITY]: 'Invalid bottle quantity',
    [ErrorCode.BOTTLE_LEDGER_ERROR]: 'Error updating bottle ledger',

    // Calendar
    [ErrorCode.PAUSE_LIMIT_EXCEEDED]: 'Pause limit exceeded for this month',
    [ErrorCode.MODIFICATION_NOT_ALLOWED]: 'Modification not allowed for this date',
    [ErrorCode.INVALID_DATE]: 'Invalid date format',
    [ErrorCode.PAST_DATE_NOT_ALLOWED]: 'Cannot modify deliveries in the past',

    // Admin
    [ErrorCode.ADMIN_NOT_FOUND]: 'Admin not found',
    [ErrorCode.DELIVERY_PERSON_NOT_FOUND]: 'Delivery person not found',
    [ErrorCode.DELIVERY_PERSON_ALREADY_EXISTS]: 'A delivery person with this phone number already exists',

    // Validation
    [ErrorCode.VALIDATION_ERROR]: 'Validation error',
    [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
    [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field missing',
    [ErrorCode.INVALID_PHONE_FORMAT]: 'Invalid phone number format',
    [ErrorCode.INVALID_EMAIL_FORMAT]: 'Invalid email format',

    // System
    [ErrorCode.DATABASE_ERROR]: 'Database error. Please try again',
    [ErrorCode.TRANSACTION_FAILED]: 'Transaction failed. Please try again',
    [ErrorCode.CONCURRENT_MODIFICATION]: 'This record was modified by another user. Please refresh and try again',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
    [ErrorCode.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred. Please try again',
  };

  return messages[code] || 'An error occurred';
}

/**
 * Application Constants
 *
 * Centralized configuration values to avoid magic numbers throughout the codebase.
 * All configurable values should be defined here with clear documentation.
 */

// ============================================================================
// BUSINESS RULES
// ============================================================================

/**
 * Pause Cutoff Hour (IST)
 * Customers can pause tomorrow's delivery until this hour (5:00 PM IST)
 * After this hour, they can only pause from day after tomorrow onwards
 */
export const PAUSE_CUTOFF_HOUR = 17; // 5:00 PM

/**
 * Payment day of the month
 * Subscriptions renew on this day every month
 */
export const PAYMENT_DAY = 5; // 5th of every month

/**
 * Grace period for negative wallet balance (in paise)
 * Customers can have negative balance up to this amount (1 day's charge)
 * This is calculated dynamically based on subscription price
 */
export const WALLET_GRACE_PERIOD_MULTIPLIER = -1; // -1 × daily price

// ============================================================================
// VALIDATION LIMITS
// ============================================================================

/**
 * Customer input validation
 */
export const VALIDATION = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
  PHONE: {
    LENGTH: 10, // Indian phone numbers
  },
  PINCODE: {
    LENGTH: 6, // Indian postal codes
  },
  ADDRESS: {
    MAX_LENGTH: 500,
  },
  NOTES: {
    MAX_LENGTH: 1000,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
  },
  EMAIL: {
    MAX_LENGTH: 255,
  },
} as const;

/**
 * Quantity validation (in milliliters)
 * Maximum quantity limited to 2.5L per day
 */
export const QUANTITY = {
  MIN_ML: 500,
  MAX_ML: 2500,
  STANDARD_500ML: 500,
  STANDARD_1L: 1000,
  STANDARD_1_5L: 1500,
  STANDARD_2L: 2000,
  STANDARD_2_5L: 2500,
} as const;

/**
 * Bottle limits per delivery
 */
export const BOTTLES = {
  MIN_PER_DELIVERY: 0,
  MAX_PER_DELIVERY: 10,
  PENALTY_DAYS_THRESHOLD: 5, // Days before penalty applies
} as const;

/**
 * Payment/Wallet limits
 */
export const PAYMENT = {
  MIN_AMOUNT_RS: 0,
  MAX_AMOUNT_RS: 100000, // ₹1,00,000 max per transaction
  MIN_WALLET_BALANCE_RS: -1000, // Can go ₹1000 negative (grace period)
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limiting configuration for different endpoint types
 * Format: { windowMs: time window in milliseconds, max: max requests in window }
 */
export const RATE_LIMITS = {
  /**
   * General API endpoints
   * 100 requests per 15 minutes per IP
   */
  API: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 1000, // TEMP: Was 100, increased for dev
    WINDOW_NAME: '15 minutes',
  },

  /**
   * Authentication endpoints (login, signup)
   * Stricter limit to prevent brute force attacks
   * DEVELOPMENT: Increased to 1000 for testing (change to 10 in production)
   */
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 1000, // TEMP: Was 10, increased for dev
    WINDOW_NAME: '15 minutes',
  },

  /**
   * Password reset endpoint
   * Very strict to prevent abuse
   * 3 attempts per hour per IP
   */
  PASSWORD_RESET: {
    WINDOW_MS: 60 * 60 * 1000, // 1 hour
    MAX_REQUESTS: 3,
    WINDOW_NAME: '1 hour',
  },

  /**
   * Delivery marking endpoint
   * High limit for delivery persons marking many deliveries
   * 30 requests per minute (one every 2 seconds)
   */
  DELIVERY_ACTION: {
    WINDOW_MS: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS: 30,
    WINDOW_NAME: '1 minute',
  },

  /**
   * Wallet operations (topup, refund)
   * Moderate limit to prevent abuse
   * 10 operations per 5 minutes per IP
   */
  WALLET: {
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    MAX_REQUESTS: 10,
    WINDOW_NAME: '5 minutes',
  },

  /**
   * Admin operations
   * Higher limit for admin dashboard operations
   * 60 requests per minute per IP
   */
  ADMIN: {
    WINDOW_MS: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS: 60,
    WINDOW_NAME: '1 minute',
  },
} as const;

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Pagination defaults for list endpoints
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100, // Maximum items per page
  MIN_LIMIT: 10,  // Minimum items per page
} as const;

// ============================================================================
// SESSION & CACHE
// ============================================================================

/**
 * Session configuration
 */
export const SESSION = {
  /**
   * Session expiry time
   * 7 days in milliseconds
   */
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  /**
   * Session warning time (show warning before expiry)
   * 5 minutes before expiry
   */
  WARNING_BEFORE_MS: 5 * 60 * 1000, // 5 minutes

  /**
   * Cookie name for session ID
   */
  COOKIE_NAME: 'maa-ilay.sid',
} as const;

/**
 * Cache TTL (Time To Live) for different data types
 */
export const CACHE_TTL = {
  /**
   * Static data that rarely changes (pricing, config)
   * 1 hour
   */
  STATIC_DATA_MS: 60 * 60 * 1000, // 1 hour

  /**
   * User session data
   * 15 minutes
   */
  USER_SESSION_MS: 15 * 60 * 1000, // 15 minutes

  /**
   * Calendar/delivery data (changes frequently)
   * 5 minutes
   */
  CALENDAR_DATA_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// ============================================================================
// DATABASE
// ============================================================================

/**
 * Database configuration
 */
export const DATABASE = {
  /**
   * Connection pool size
   * Adjust based on expected load
   */
  POOL_MIN: 2,
  POOL_MAX: 10,

  /**
   * Query timeout (milliseconds)
   * Queries taking longer than this will be cancelled
   */
  QUERY_TIMEOUT_MS: 30000, // 30 seconds

  /**
   * Transaction timeout (milliseconds)
   * Transactions taking longer than this will be rolled back
   */
  TRANSACTION_TIMEOUT_MS: 10000, // 10 seconds
} as const;

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check thresholds
 */
export const HEALTH = {
  /**
   * Maximum response time for database health check (ms)
   * If database takes longer, mark as degraded
   */
  DB_MAX_RESPONSE_MS: 1000, // 1 second

  /**
   * Minimum free disk space (MB)
   * Alert if disk space falls below this
   */
  MIN_DISK_SPACE_MB: 1000, // 1 GB

  /**
   * Maximum memory usage percentage
   * Alert if memory usage exceeds this
   */
  MAX_MEMORY_USAGE_PCT: 90, // 90%
} as const;

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Logging configuration
 */
export const LOGGING = {
  /**
   * Log file retention (days)
   * Keep logs for this many days before deletion
   */
  RETENTION_DAYS: 30,

  /**
   * Maximum log file size (MB)
   * Rotate logs when file reaches this size
   */
  MAX_FILE_SIZE_MB: 100,

  /**
   * Request body size limit for logging (bytes)
   * Don't log request bodies larger than this
   */
  MAX_BODY_SIZE_BYTES: 10000, // 10 KB
} as const;

// ============================================================================
// SECURITY
// ============================================================================

/**
 * Security configuration
 */
export const SECURITY = {
  /**
   * CSRF token size (bytes)
   */
  CSRF_TOKEN_SIZE: 64,

  /**
   * Password hash rounds (bcrypt)
   * Higher = more secure but slower
   */
  BCRYPT_ROUNDS: 12,

  /**
   * Session secret minimum length
   */
  SESSION_SECRET_MIN_LENGTH: 32,

  /**
   * CSRF secret minimum length
   */
  CSRF_SECRET_MIN_LENGTH: 32,

  /**
   * Maximum login attempts before lockout
   */
  MAX_LOGIN_ATTEMPTS: 5,

  /**
   * Account lockout duration (ms)
   * 15 minutes
   */
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable time from milliseconds
 */
export function msToHumanReadable(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

/**
 * Validate environment variables on startup
 */
export function validateRequiredEnvVars(): void {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'CSRF_SECRET',
    'FRONTEND_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate secret lengths
  if (process.env.SESSION_SECRET!.length < SECURITY.SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${SECURITY.SESSION_SECRET_MIN_LENGTH} characters`);
  }

  if (process.env.CSRF_SECRET!.length < SECURITY.CSRF_SECRET_MIN_LENGTH) {
    throw new Error(`CSRF_SECRET must be at least ${SECURITY.CSRF_SECRET_MIN_LENGTH} characters`);
  }
}

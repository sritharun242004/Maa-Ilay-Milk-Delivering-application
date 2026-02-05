import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Input Sanitization Utilities
 *
 * Protects against:
 * - XSS (Cross-Site Scripting)
 * - SQL Injection (already protected by Prisma)
 * - HTML Injection
 * - Script Injection
 */

/**
 * Sanitize string input - removes HTML, scripts, and dangerous characters
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';

  // Convert to string and trim
  let cleaned = String(input).trim();

  // Remove any HTML tags and scripts
  cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] });

  // Escape special characters
  cleaned = validator.escape(cleaned);

  return cleaned;
}

/**
 * Sanitize HTML content - allows safe HTML tags only
 */
export function sanitizeHTML(input: string | null | undefined): string {
  if (!input) return '';

  return DOMPurify.sanitize(String(input), {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  const cleaned = String(email).toLowerCase().trim();

  // Normalize and validate email format
  if (!validator.isEmail(cleaned)) {
    throw new Error('Invalid email format');
  }

  return validator.normalizeEmail(cleaned) || cleaned;
}

/**
 * Sanitize phone number - removes non-numeric characters
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const cleaned = String(phone).replace(/\D/g, '');

  // Validate length (10 digits for Indian numbers)
  if (cleaned.length !== 10) {
    throw new Error('Phone number must be 10 digits');
  }

  return cleaned;
}

/**
 * Sanitize name - allows only letters, spaces, and common name characters
 */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return '';

  let cleaned = String(name).trim();

  // Remove any HTML
  cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] });

  // Remove special characters except spaces, hyphens, apostrophes, and dots
  cleaned = cleaned.replace(/[^a-zA-Z\s\-'.]/g, '');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Validate length
  if (cleaned.length < 2) {
    throw new Error('Name must be at least 2 characters');
  }

  if (cleaned.length > 100) {
    throw new Error('Name is too long (max 100 characters)');
  }

  return cleaned;
}

/**
 * Sanitize address - allows alphanumeric and common address characters
 */
export function sanitizeAddress(address: string | null | undefined): string {
  if (!address) return '';

  let cleaned = String(address).trim();

  // Remove any HTML
  cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] });

  // Allow alphanumeric, spaces, and common address characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s,.\-#/()]/g, '');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Validate length
  if (cleaned.length > 500) {
    throw new Error('Address is too long (max 500 characters)');
  }

  return cleaned;
}

/**
 * Sanitize pincode (Indian postal codes)
 */
export function sanitizePincode(pincode: string | null | undefined): string {
  if (!pincode) return '';

  const cleaned = String(pincode).replace(/\D/g, '');

  if (cleaned.length !== 6) {
    throw new Error('Pincode must be 6 digits');
  }

  return cleaned;
}

/**
 * Sanitize notes/remarks - allows text with basic formatting
 */
export function sanitizeNotes(notes: string | null | undefined): string {
  if (!notes) return '';

  let cleaned = String(notes).trim();

  // Remove dangerous HTML but allow basic formatting
  cleaned = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: ['b', 'i', 'br'],
    ALLOWED_ATTR: []
  });

  // Limit length
  if (cleaned.length > 1000) {
    throw new Error('Notes are too long (max 1000 characters)');
  }

  return cleaned;
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(
  input: string | number | null | undefined,
  options?: { min?: number; max?: number; integer?: boolean }
): number {
  if (input === null || input === undefined || input === '') {
    throw new Error('Number is required');
  }

  const num = Number(input);

  if (isNaN(num)) {
    throw new Error('Invalid number format');
  }

  if (options?.integer && !Number.isInteger(num)) {
    throw new Error('Must be an integer');
  }

  if (options?.min !== undefined && num < options.min) {
    throw new Error(`Number must be at least ${options.min}`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new Error(`Number must be at most ${options.max}`);
  }

  return num;
}

/**
 * Sanitize date string (YYYY-MM-DD format)
 */
export function sanitizeDateString(dateStr: string | null | undefined): string {
  if (!dateStr) {
    throw new Error('Date is required');
  }

  const cleaned = String(dateStr).trim();

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  // Validate actual date
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return cleaned;
}

/**
 * Sanitize enum value
 */
export function sanitizeEnum<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  fieldName: string = 'Value'
): T {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  const cleaned = String(value).trim().toUpperCase();

  if (!allowedValues.includes(cleaned as T)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }

  return cleaned as T;
}

/**
 * Sanitize customer profile data
 */
export function sanitizeCustomerProfile(data: any) {
  return {
    name: sanitizeName(data.name),
    phone: sanitizePhone(data.phone),
    addressLine1: sanitizeAddress(data.addressLine1),
    addressLine2: data.addressLine2 ? sanitizeAddress(data.addressLine2) : null,
    landmark: data.landmark ? sanitizeAddress(data.landmark) : null,
    city: sanitizeName(data.city || 'Pondicherry'),
    pincode: sanitizePincode(data.pincode),
  };
}

/**
 * Sanitize delivery notes
 */
export function sanitizeDeliveryData(data: any) {
  const sanitized: any = {};

  if (data.status) {
    sanitized.status = sanitizeEnum(
      data.status,
      ['DELIVERED', 'NOT_DELIVERED'] as const,
      'Status'
    );
  }

  if (data.deliveryNotes !== undefined) {
    sanitized.deliveryNotes = sanitizeNotes(data.deliveryNotes);
  }

  if (data.largeBottlesCollected !== undefined) {
    sanitized.largeBottlesCollected = sanitizeNumber(data.largeBottlesCollected, {
      min: 0,
      max: 100,
      integer: true
    });
  }

  if (data.smallBottlesCollected !== undefined) {
    sanitized.smallBottlesCollected = sanitizeNumber(data.smallBottlesCollected, {
      min: 0,
      max: 100,
      integer: true
    });
  }

  return sanitized;
}

/**
 * Sanitize subscription data
 */
export function sanitizeSubscriptionData(data: any) {
  return {
    dailyQuantityMl: sanitizeNumber(data.dailyQuantityMl, {
      min: 500,
      max: 10000,
      integer: true
    }),
    startDate: sanitizeDateString(data.startDate),
    endDate: sanitizeDateString(data.endDate),
  };
}

/**
 * General purpose object sanitizer
 * Recursively sanitizes all string values in an object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Express middleware for automatic request body sanitization
 */
export function sanitizeMiddleware(req: any, res: any, next: any) {
  if (req.body && typeof req.body === 'object') {
    try {
      // Sanitize all string fields in request body
      req.body = sanitizeObject(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid input data',
        details: error instanceof Error ? error.message : 'Sanitization failed'
      });
    }
  } else {
    next();
  }
}

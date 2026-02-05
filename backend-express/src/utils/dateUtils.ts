/**
 * Date Utility Functions for Pondicherry Region (IST - India Standard Time)
 * Timezone: Asia/Kolkata (UTC+5:30)
 *
 * All dates are handled consistently in IST to avoid timezone bugs.
 */

/**
 * Get current date/time in IST
 */
export function getNowIST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Get start of day in IST (00:00:00)
 * @param date Optional date, defaults to today
 */
export function getStartOfDayIST(date?: Date): Date {
  const d = date ? new Date(date) : getNowIST();
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  istDate.setHours(0, 0, 0, 0);
  return istDate;
}

/**
 * Get end of day in IST (23:59:59.999)
 * @param date Optional date, defaults to today
 */
export function getEndOfDayIST(date?: Date): Date {
  const d = date ? new Date(date) : getNowIST();
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  istDate.setHours(23, 59, 59, 999);
  return istDate;
}

/**
 * Parse YYYY-MM-DD date string to IST date at start of day
 * @param dateStr Date string in format YYYY-MM-DD
 */
export function parseISTDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create date in IST timezone
  const istString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`;
  return new Date(new Date(istString).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Convert date to YYYY-MM-DD string in IST
 * @param date Date to convert
 */
export function toISTDateString(date: Date): string {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date range in IST (start to end of day)
 */
export function getTodayRangeIST(): { start: Date; end: Date } {
  const now = getNowIST();
  return {
    start: getStartOfDayIST(now),
    end: getEndOfDayIST(now)
  };
}

/**
 * Get date range for a specific YYYY-MM-DD string in IST
 */
export function getDateRangeIST(dateStr: string): { start: Date; end: Date } {
  const date = parseISTDateString(dateStr);
  return {
    start: getStartOfDayIST(date),
    end: getEndOfDayIST(date)
  };
}

/**
 * Add days to a date in IST
 */
export function addDaysIST(date: Date, days: number): Date {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  istDate.setDate(istDate.getDate() + days);
  return istDate;
}

/**
 * Get current hour in IST (0-23)
 */
export function getCurrentHourIST(): number {
  const now = getNowIST();
  return now.getHours();
}

/**
 * Check if date is in the past (IST)
 */
export function isPastDateIST(date: Date): boolean {
  const now = getStartOfDayIST(getNowIST());
  const checkDate = getStartOfDayIST(date);
  return checkDate < now;
}

/**
 * Check if date is today (IST)
 */
export function isTodayIST(date: Date): boolean {
  const today = toISTDateString(getNowIST());
  const checkDate = toISTDateString(date);
  return today === checkDate;
}

/**
 * Get tomorrow's date in IST
 */
export function getTomorrowIST(): Date {
  return addDaysIST(getNowIST(), 1);
}

/**
 * Get yesterday's date in IST
 */
export function getYesterdayIST(): Date {
  return addDaysIST(getNowIST(), -1);
}

/**
 * Convert date to ISO timestamp string (consistent format for API responses)
 * @param date Date to convert
 * @returns ISO 8601 timestamp string (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function toISOTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Format date for human-readable display (consistent format)
 * @param date Date to format
 * @returns Formatted string like "5 Feb 2026"
 */
export function formatDateDisplay(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = istDate.getDate();
  const month = months[istDate.getMonth()];
  const year = istDate.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format date with month name (for payment dates, etc.)
 * @param date Date to format
 * @returns Formatted string like "Feb 2026"
 */
export function formatMonthYear(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const month = months[istDate.getMonth()];
  const year = istDate.getFullYear();
  return `${month} ${year}`;
}

/**
 * Get day of week name for a date
 * @param date Date to get weekday for
 * @returns Weekday name like "Monday"
 */
export function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return days[istDate.getDay()];
}

// ============================================
// DATE COLUMN QUERIES (for @db.Date fields)
// ============================================
// PostgreSQL DATE columns store only the date portion (no time).
// Deliveries are stored at UTC midnight (e.g., 2026-02-05T00:00:00.000Z).
// These functions create proper date ranges for querying DATE columns.

/**
 * Get UTC midnight date range for a given IST date string.
 * Use this when querying @db.Date columns like deliveryDate.
 * @param dateStr Date string in format YYYY-MM-DD (represents IST date)
 * @returns Start and end as UTC midnight dates
 */
export function getDateRangeForDateColumn(dateStr: string): { start: Date; end: Date } {
  // The IST date string directly maps to the UTC midnight date
  // e.g., "2026-02-05" (IST) -> stored as 2026-02-05T00:00:00.000Z
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T23:59:59.999Z');
  return { start, end };
}

/**
 * Get UTC midnight date range for today in IST.
 * Use this when querying @db.Date columns like deliveryDate.
 * @returns Start and end as UTC midnight dates for today (IST)
 */
export function getTodayRangeForDateColumn(): { start: Date; end: Date } {
  const todayIST = toISTDateString(new Date());
  return getDateRangeForDateColumn(todayIST);
}

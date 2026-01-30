/**
 * Date helpers using browser Date / Intl APIs only.
 * All dates are interpreted and formatted in the user's local timezone (live).
 */

const locale = 'en-IN';

/** Today's date formatted long, e.g. "Friday, 30 January 2026" — always matches user's "today" */
export function getLocalTodayFormatted(): string {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Today as YYYY-MM-DD in user's local timezone (for inputs, APIs) */
export function getLocalTodayISO(): string {
  return getLocalDateISO(new Date());
}

/** Tomorrow as YYYY-MM-DD in user's local timezone */
export function getLocalTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateISO(d);
}

/** YYYY-MM-DD from a Date using local date parts (no UTC shift) */
export function getLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DateFormat = 'short' | 'long' | 'iso';

/**
 * Format an ISO date string or Date in user's local timezone.
 * - short: "30 Jan"
 * - long: "Friday, 30 January 2026"
 * - iso: "YYYY-MM-DD" (local date parts)
 */
export function formatDateLocal(
  isoOrDate: string | Date,
  format: DateFormat = 'short'
): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  switch (format) {
    case 'long':
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'iso': {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    default:
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }
}

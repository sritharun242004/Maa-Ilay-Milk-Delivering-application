/**
 * Maa Ilay pricing (fallback values — actual prices loaded from DB via /api/pricing)
 * - 500ml: ₹72/day
 * - 1L: ₹120/day
 * - 1.5L: ₹192/day
 * - 2L: ₹240/day
 * - 2.5L: ₹312/day
 *
 * Bottle deposit: ₹70 for 1L, ₹50 for 500ml (every 120 deliveries)
 * Payment due: 7th of every month (monthly upfront model)
 * Maximum quantity: 2.5L per day
 */
export const PRICING = {
  DAILY_1L_RS: 120,
  DAILY_500ML_RS: 72,
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  MIN_BALANCE_3_DAYS_1L_RS: 360,
  MIN_BALANCE_1_DAY_1L_RS: 120,
  MIN_BALANCE_3_DAYS_500ML_RS: 216,
  MIN_BALANCE_1_DAY_500ML_RS: 72,
  PAYMENT_DAY: 7,
  GRACE_PERIOD_END_DAY: 7,
  NEXT_MONTH_PREVIEW_DAYS: 3,
} as const;

/** Get number of days in a month (1-indexed month) */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Get month name */
export function getMonthName(month: number): string {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month] || '';
}

// Pricing map for each quantity
export const DAILY_PRICE_MAP: Record<number, number> = {
  500: 72,
  1000: 120,
  1500: 192,
  2000: 240,
  2500: 312,
};

/** Daily quantity options: 500ml to 2.5L */
export const DAILY_QUANTITY_OPTIONS = [
  { liters: 0.5, label: '0.5L', dailyRs: 72 },
  { liters: 1, label: '1L', dailyRs: 120 },
  { liters: 1.5, label: '1.5L', dailyRs: 192 },
  { liters: 2, label: '2L', dailyRs: 240 },
  { liters: 2.5, label: '2.5L', dailyRs: 312 },
] as const;

export const PLANS = [
  {
    id: '1l',
    name: '1 Liter',
    dailyRs: PRICING.DAILY_1L_RS,
    depositRs: PRICING.DEPOSIT_1L_RS,
    bottles: 2,
    firstMonthRs: (days: number) => days * PRICING.DAILY_1L_RS + PRICING.DEPOSIT_1L_RS,
    renewalMonthRs: (days: number) => days * PRICING.DAILY_1L_RS,
    depositEveryDeliveries: 120, // Every 120 actual deliveries
  },
  {
    id: '500ml',
    name: '500 ML',
    dailyRs: PRICING.DAILY_500ML_RS,
    depositRs: PRICING.DEPOSIT_500ML_RS,
    bottles: 2,
    firstMonthRs: (days: number) => days * PRICING.DAILY_500ML_RS + PRICING.DEPOSIT_500ML_RS,
    renewalMonthRs: (days: number) => days * PRICING.DAILY_500ML_RS,
    depositEveryDeliveries: 120, // Every 120 actual deliveries
  },
] as const;

/**
 * Maa Ilay pricing (matches backend)
 * Updated pricing structure with volume-based discounts:
 * - 500ml: ₹68/day
 * - 1L: ₹110/day
 * - 1.5L: ₹165/day
 * - 2L: ₹215/day
 * - 2.5L: ₹268/day
 *
 * Bottle deposit: ₹70 for 1L, ₹50 for 500ml (every 90 days)
 * Payment date: 5th of every month. Balance always shown in ₹.
 * Maximum quantity: 2.5L per day
 */
export const PRICING = {
  DAILY_1L_RS: 110,
  DAILY_500ML_RS: 68,
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  /** Min balance for 3 days (below this → "About to expire") */
  MIN_BALANCE_3_DAYS_1L_RS: 330,
  MIN_BALANCE_1_DAY_1L_RS: 110,
  MIN_BALANCE_3_DAYS_500ML_RS: 204,
  MIN_BALANCE_1_DAY_500ML_RS: 68,
  PAYMENT_DAY: 5,
} as const;

// Pricing map for each quantity (with volume discounts)
export const DAILY_PRICE_MAP: Record<number, number> = {
  500: 68,
  1000: 110,
  1500: 165,
  2000: 215,
  2500: 268,
};

/** Daily quantity options: 500ml to 2.5L with exact pricing (includes volume discounts) */
export const DAILY_QUANTITY_OPTIONS = [
  { liters: 0.5, label: '0.5L', dailyRs: 68 },
  { liters: 1, label: '1L', dailyRs: 110 },
  { liters: 1.5, label: '1.5L', dailyRs: 165 },
  { liters: 2, label: '2L', dailyRs: 215 },
  { liters: 2.5, label: '2.5L', dailyRs: 268 },
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
    depositEveryMonths: 3,
  },
  {
    id: '500ml',
    name: '500 ML',
    dailyRs: PRICING.DAILY_500ML_RS,
    depositRs: PRICING.DEPOSIT_500ML_RS,
    bottles: 2,
    firstMonthRs: (days: number) => days * PRICING.DAILY_500ML_RS + PRICING.DEPOSIT_500ML_RS,
    renewalMonthRs: (days: number) => days * PRICING.DAILY_500ML_RS,
    depositEveryMonths: 3,
  },
] as const;

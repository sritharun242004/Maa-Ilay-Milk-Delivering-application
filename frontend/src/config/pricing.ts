/**
 * Maa Ilay pricing (matches backend)
 * 1L: ₹110/day, 2 bottles deposit ₹70 (every 90 days)
 * 500ml: ₹68/day, 2 bottles deposit ₹50 (every 90 days)
 * Payment date: 5th of every month. Balance always shown in ₹.
 */
export const PRICING = {
  DAILY_1L_RS: 110,
  DAILY_500ML_RS: 68,
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  MAX_PAUSE_DAYS_PER_MONTH: 5,
  /** Min balance for 3 days (below this → "About to expire") */
  MIN_BALANCE_3_DAYS_1L_RS: 330,
  MIN_BALANCE_1_DAY_1L_RS: 110,
  MIN_BALANCE_3_DAYS_500ML_RS: 204,
  MIN_BALANCE_1_DAY_500ML_RS: 68,
  PAYMENT_DAY: 5,
} as const;

/** Daily quantity options: 0.5L to 4L (500ml–4000ml) with daily rate in ₹ */
export const DAILY_QUANTITY_OPTIONS = [
  { liters: 0.5, label: '0.5L', dailyRs: PRICING.DAILY_500ML_RS },
  { liters: 1, label: '1L', dailyRs: PRICING.DAILY_1L_RS },
  { liters: 1.5, label: '1.5L', dailyRs: PRICING.DAILY_1L_RS + PRICING.DAILY_500ML_RS },
  { liters: 2, label: '2L', dailyRs: PRICING.DAILY_1L_RS * 2 },
  { liters: 2.5, label: '2.5L', dailyRs: PRICING.DAILY_1L_RS * 2.5 },
  { liters: 3, label: '3L', dailyRs: PRICING.DAILY_1L_RS * 3 },
  { liters: 3.5, label: '3.5L', dailyRs: PRICING.DAILY_1L_RS * 3.5 },
  { liters: 4, label: '4L', dailyRs: PRICING.DAILY_1L_RS * 4 },
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

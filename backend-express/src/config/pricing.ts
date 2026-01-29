/**
 * Maa Ilay pricing (Rs. and paise)
 * 1L: ₹110/day, 2 bottles deposit ₹70 (every 90 days / every 4th cycle)
 * 500ml: ₹68/day, 2 bottles deposit ₹50 (every 90 days)
 */

export const PRICING = {
  // Per day (paise)
  DAILY_1L_PAISE: 11000,       // ₹110
  DAILY_500ML_PAISE: 6800,     // ₹68
  // Rupees (for display)
  DAILY_1L_RS: 110,
  DAILY_500ML_RS: 68,
  // Bottle deposit (paise) — charged every 90 days (cycles 1, 4, 7, ...)
  DEPOSIT_1L_PAISE: 7000,      // 2 × ₹35 = ₹70
  DEPOSIT_500ML_PAISE: 5000,   // 2 × ₹25 = ₹50
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  // Max pause days per month
  MAX_PAUSE_DAYS_PER_MONTH: 5,
  // Deposit every N cycles (every 90 days ≈ every 3 months, so cycle 1, 4, 7...)
  DEPOSIT_EVERY_CYCLES: 3,
} as const;

export function isDepositCycle(cycleNumber: number): boolean {
  return cycleNumber <= 1 || (cycleNumber - 1) % PRICING.DEPOSIT_EVERY_CYCLES === 0;
}

export function monthlyMilkChargePaise(dailyPaise: number, daysInMonth: number): number {
  return dailyPaise * daysInMonth;
}

export function firstMonthTotalPaise1L(daysInMonth: number): number {
  return PRICING.DAILY_1L_PAISE * daysInMonth + PRICING.DEPOSIT_1L_PAISE;
}

export function firstMonthTotalPaise500ml(daysInMonth: number): number {
  return PRICING.DAILY_500ML_PAISE * daysInMonth + PRICING.DEPOSIT_500ML_PAISE;
}

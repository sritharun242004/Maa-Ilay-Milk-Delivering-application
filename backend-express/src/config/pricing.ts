/**
 * My Life / Maa Ilay pricing (Rs. and paise)
 * Updated pricing structure with volume-based discounts:
 * - 500ml: ₹68/day
 * - 1L: ₹110/day
 * - 1.5L: ₹165/day
 * - 2L: ₹215/day
 * - 2.5L: ₹268/day
 *
 * Bottle deposit: ₹70 for 1L bottles, ₹50 for 500ml bottles (every 90 days)
 * Payment date: 5th of every month
 * Allowed daily quantities: 500ml to 2.5L only
 * Bottle load: 1L bottles + 500ml bottles (e.g. 2.5L = 2×1L + 1×500ml)
 */

export const ALLOWED_DAILY_QUANTITIES_ML = [500, 1000, 1500, 2000, 2500] as const;

// Pricing lookup table for each quantity (in paise)
export const DAILY_PRICE_MAP_PAISE: Record<number, number> = {
  500: 6800,    // ₹68
  1000: 11000,  // ₹110
  1500: 16500,  // ₹165
  2000: 21500,  // ₹215
  2500: 26800,  // ₹268
};

// Pricing lookup table for each quantity (in rupees)
export const DAILY_PRICE_MAP_RS: Record<number, number> = {
  500: 68,
  1000: 110,
  1500: 165,
  2000: 215,
  2500: 268,
};

export const PRICING = {
  // Per day (paise) - base prices
  DAILY_1L_PAISE: 11000,       // ₹110
  DAILY_500ML_PAISE: 6800,     // ₹68
  // Rupees (for display and min-balance checks)
  DAILY_1L_RS: 110,
  DAILY_500ML_RS: 68,
  // Min balance: need at least 3 days to show "ACTIVE", else "About to expire"; < 1 day = "Renew or add money"
  MIN_BALANCE_3_DAYS_1L_RS: 330,    // 3 × 110
  MIN_BALANCE_1_DAY_1L_RS: 110,
  MIN_BALANCE_3_DAYS_500ML_RS: 204, // 3 × 68
  MIN_BALANCE_1_DAY_500ML_RS: 68,
  // Bottle deposit (paise) — charged every 90 days (cycles 1, 4, 7, ...)
  DEPOSIT_1L_PAISE: 7000,      // 2 × ₹35 = ₹70
  DEPOSIT_500ML_PAISE: 5000,   // 2 × ₹25 = ₹50
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  // Deposit every N cycles (every 90 days ≈ every 3 months, so cycle 1, 4, 7...)
  DEPOSIT_EVERY_CYCLES: 3,
  // Payment is on 5th of every month
  PAYMENT_DAY: 5,
} as const;

export function calculateDailyPricePaise(quantityMl: number): number {
  // Use lookup table for exact pricing (includes volume discounts)
  if (quantityMl in DAILY_PRICE_MAP_PAISE) {
    return DAILY_PRICE_MAP_PAISE[quantityMl];
  }

  // Fallback for custom quantities (shouldn't happen with current business rules)
  // Calculate based on bottles as before
  const largeBottles = Math.floor(quantityMl / 1000);
  const remainingMl = quantityMl % 1000;
  const smallBottles = remainingMl >= 500 ? 1 : 0;
  return (largeBottles * PRICING.DAILY_1L_PAISE) + (smallBottles * PRICING.DAILY_500ML_PAISE);
}

export function calculateDailyPriceRs(quantityMl: number): number {
  // Use lookup table for exact pricing
  if (quantityMl in DAILY_PRICE_MAP_RS) {
    return DAILY_PRICE_MAP_RS[quantityMl];
  }

  // Fallback
  return calculateDailyPricePaise(quantityMl) / 100;
}

/**
 * Calculate bottle deposit based on subscription quantity
 * Deposit = ₹35 per 1L bottle × 2 + ₹25 per 500ml bottle × 2
 */
export function calculateBottleDepositPaise(quantityMl: number): number {
  const largeBottles = Math.floor(quantityMl / 1000);
  const remainingMl = quantityMl % 1000;
  const smallBottles = remainingMl >= 500 ? 1 : 0;

  // Deposit per bottle type × 2 (we give 2 bottles per type)
  const largeDepositPaise = largeBottles * 3500 * 2; // ₹35 × 2 per large bottle
  const smallDepositPaise = smallBottles * 2500 * 2; // ₹25 × 2 per small bottle

  return largeDepositPaise + smallDepositPaise;
}

/**
 * Check if deposit should be charged based on delivery count
 *
 * IMPORTANT: First deposit is charged when admin assigns delivery person (not on first delivery)
 * After that, charge every 90 actual deliveries (at 90, 180, 270, etc.)
 *
 * @param deliveryCount - Current total delivery count (incremented AFTER delivery is marked)
 * @param lastDepositAtDelivery - Delivery count when last deposit was charged
 * @returns true if deposit should be charged now
 */
export function shouldChargeDeposit(deliveryCount: number, lastDepositAtDelivery: number): boolean {
  // First deposit is charged during admin assignment when lastDepositAtDelivery is set to 0
  // So when deliveryCount reaches 1 (first actual delivery), we should NOT charge again
  // Only charge on subsequent 90-delivery milestones

  // Never charge on first delivery (deliveryCount === 1), as deposit already charged at assignment
  if (deliveryCount === 1) {
    return false;
  }

  // Charge every 90 deliveries after the last deposit
  // This will trigger at deliveryCount = 90, 180, 270, etc.
  if (deliveryCount > 0 && deliveryCount - lastDepositAtDelivery >= 90) {
    return true;
  }

  return false;
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

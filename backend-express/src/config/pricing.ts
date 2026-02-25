/**
 * My Life / Maa Ilay pricing (Rs. and paise)
 * Updated pricing structure (door delivery prices):
 * - 500ml: ₹72/day
 * - 1L: ₹120/day
 * - 1.5L: ₹192/day
 * - 2L: ₹240/day
 * - 2.5L: ₹312/day
 *
 * Bottle deposit: ₹70 for 1L bottles, ₹50 for 500ml bottles (every 90 days)
 * Payment due: 7th of every month (monthly upfront model)
 * Allowed daily quantities: 500ml to 2.5L only
 * Bottle load: 1L bottles + 500ml bottles (e.g. 2.5L = 2×1L + 1×500ml)
 *
 * NOTE: These hardcoded values serve as fallbacks.
 * Live prices are loaded from ProductPricing DB table via pricingLoader.
 */

import { loadPricing } from './pricingLoader';

export const ALLOWED_DAILY_QUANTITIES_ML = [500, 1000, 1500, 2000, 2500] as const;

// Hardcoded fallback lookup tables (used by seed script and as defaults)
export const DAILY_PRICE_MAP_PAISE: Record<number, number> = {
  500: 7200,    // ₹72
  1000: 12000,  // ₹120
  1500: 19200,  // ₹192
  2000: 24000,  // ₹240
  2500: 31200,  // ₹312
};

export const DAILY_PRICE_MAP_RS: Record<number, number> = {
  500: 72,
  1000: 120,
  1500: 192,
  2000: 240,
  2500: 312,
};

export const PRICING = {
  DAILY_1L_PAISE: 12000,
  DAILY_500ML_PAISE: 7200,
  DAILY_1L_RS: 120,
  DAILY_500ML_RS: 72,
  MIN_BALANCE_3_DAYS_1L_RS: 360,
  MIN_BALANCE_1_DAY_1L_RS: 120,
  MIN_BALANCE_3_DAYS_500ML_RS: 216,
  MIN_BALANCE_1_DAY_500ML_RS: 72,
  DEPOSIT_1L_PAISE: 7000,
  DEPOSIT_500ML_PAISE: 5000,
  DEPOSIT_1L_RS: 70,
  DEPOSIT_500ML_RS: 50,
  DEPOSIT_EVERY_CYCLES: 3,
  PAYMENT_DAY: 7,
} as const;

/**
 * Calculate daily price in paise from DB pricing.
 * Falls back to hardcoded map if quantity not found.
 */
export async function calculateDailyPricePaise(quantityMl: number): Promise<number> {
  const tiers = await loadPricing();
  const tier = tiers.find(t => t.quantityMl === quantityMl);
  if (tier) return tier.dailyPricePaise;

  // Fallback to hardcoded map
  if (quantityMl in DAILY_PRICE_MAP_PAISE) {
    return DAILY_PRICE_MAP_PAISE[quantityMl];
  }

  // Fallback for custom quantities
  const largeBottles = Math.floor(quantityMl / 1000);
  const remainingMl = quantityMl % 1000;
  const smallBottles = remainingMl >= 500 ? 1 : 0;
  return (largeBottles * PRICING.DAILY_1L_PAISE) + (smallBottles * PRICING.DAILY_500ML_PAISE);
}

/**
 * Calculate daily price in rupees from DB pricing.
 */
export async function calculateDailyPriceRs(quantityMl: number): Promise<number> {
  const paise = await calculateDailyPricePaise(quantityMl);
  return paise / 100;
}

/**
 * Calculate bottle deposit based on subscription quantity using DB pricing.
 * Deposit = depositPaise per bottle type × 2 (we give 2 bottles per type)
 */
export async function calculateBottleDepositPaise(quantityMl: number): Promise<number> {
  const tiers = await loadPricing();

  // Find deposit prices — use the first tier's deposit values (they're uniform across tiers)
  const anyTier = tiers[0];
  const largeDepositPerBottle = anyTier?.largeBottleDepositPaise ?? 3500;
  const smallDepositPerBottle = anyTier?.smallBottleDepositPaise ?? 2500;

  const largeBottles = Math.floor(quantityMl / 1000);
  const remainingMl = quantityMl % 1000;
  const smallBottles = remainingMl >= 500 ? 1 : 0;

  // Deposit per bottle type × 2 (we give 2 bottles per type)
  const largeDepositPaise = largeBottles * largeDepositPerBottle * 2;
  const smallDepositPaise = smallBottles * smallDepositPerBottle * 2;

  return largeDepositPaise + smallDepositPaise;
}

/**
 * Check if deposit should be charged based on delivery count
 *
 * IMPORTANT: First deposit is charged when admin assigns delivery person (not on first delivery)
 * After that, charge every 90 actual deliveries (at 90, 180, 270, etc.)
 */
export function shouldChargeDeposit(deliveryCount: number, lastDepositAtDelivery: number): boolean {
  if (deliveryCount === 1) {
    return false;
  }
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

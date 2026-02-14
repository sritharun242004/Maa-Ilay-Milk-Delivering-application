/**
 * Pricing Loader — cached DB reader for ProductPricing table
 * Falls back to hardcoded defaults if DB is empty or unreachable
 */

import prisma from './prisma';

interface PricingTier {
  quantityMl: number;
  label: string;
  dailyPricePaise: number;
  largeBottleDepositPaise: number;
  smallBottleDepositPaise: number;
}

// Hardcoded defaults (fallback when DB is empty)
const DEFAULT_TIERS: PricingTier[] = [
  { quantityMl: 500,  label: '500ml', dailyPricePaise: 6800,  largeBottleDepositPaise: 3500, smallBottleDepositPaise: 2500 },
  { quantityMl: 1000, label: '1L',    dailyPricePaise: 11000, largeBottleDepositPaise: 3500, smallBottleDepositPaise: 2500 },
  { quantityMl: 1500, label: '1.5L',  dailyPricePaise: 16500, largeBottleDepositPaise: 3500, smallBottleDepositPaise: 2500 },
  { quantityMl: 2000, label: '2L',    dailyPricePaise: 21500, largeBottleDepositPaise: 3500, smallBottleDepositPaise: 2500 },
  { quantityMl: 2500, label: '2.5L',  dailyPricePaise: 26800, largeBottleDepositPaise: 3500, smallBottleDepositPaise: 2500 },
];

let cache: PricingTier[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load pricing tiers from DB (cached for 5 min).
 * Falls back to hardcoded defaults on error or empty table.
 */
export async function loadPricing(): Promise<PricingTier[]> {
  const now = Date.now();
  if (cache && now < cacheExpiry) {
    return cache;
  }

  try {
    const rows = await prisma.productPricing.findMany({
      where: { isActive: true },
      orderBy: { quantityMl: 'asc' },
      select: {
        quantityMl: true,
        label: true,
        dailyPricePaise: true,
        largeBottleDepositPaise: true,
        smallBottleDepositPaise: true,
      },
    });

    if (rows.length > 0) {
      cache = rows;
      cacheExpiry = now + CACHE_TTL_MS;
      return cache;
    }
  } catch (e) {
    console.error('Failed to load pricing from DB, using defaults:', e);
  }

  // Fallback to hardcoded defaults
  cache = DEFAULT_TIERS;
  cacheExpiry = now + CACHE_TTL_MS;
  return cache;
}

/**
 * Invalidate pricing cache — call after admin updates pricing
 */
export function invalidatePricingCache(): void {
  cache = null;
  cacheExpiry = 0;
}

import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { PRICING, DAILY_PRICE_MAP, DAILY_QUANTITY_OPTIONS } from '../config/pricing';

interface PricingTier {
  quantityMl: number;
  label: string;
  dailyPricePaise: number;
  largeBottleDepositPaise: number;
  smallBottleDepositPaise: number;
}

interface PricingData {
  /** Quantity options for subscription selection (label, liters, dailyRs) */
  quantityOptions: Array<{ liters: number; label: string; dailyRs: number }>;
  /** Price map: quantityMl → dailyRs */
  priceMap: Record<number, number>;
  /** Raw tiers from API */
  tiers: PricingTier[];
  /** Convenience: 1L daily price in Rs */
  daily1LRs: number;
  /** Convenience: 500ml daily price in Rs */
  daily500mlRs: number;
  /** Loading state */
  loading: boolean;
}

let cachedTiers: PricingTier[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function buildFromTiers(tiers: PricingTier[]): Omit<PricingData, 'loading'> {
  const quantityOptions = tiers.map(t => ({
    liters: t.quantityMl / 1000,
    label: t.label,
    dailyRs: t.dailyPricePaise / 100,
  }));

  const priceMap: Record<number, number> = {};
  for (const t of tiers) {
    priceMap[t.quantityMl] = t.dailyPricePaise / 100;
  }

  const tier1L = tiers.find(t => t.quantityMl === 1000);
  const tier500ml = tiers.find(t => t.quantityMl === 500);

  return {
    quantityOptions,
    priceMap,
    tiers,
    daily1LRs: tier1L ? tier1L.dailyPricePaise / 100 : PRICING.DAILY_1L_RS,
    daily500mlRs: tier500ml ? tier500ml.dailyPricePaise / 100 : PRICING.DAILY_500ML_RS,
  };
}

/** Hardcoded fallback data (matches config/pricing.ts) */
function getFallback(): Omit<PricingData, 'loading'> {
  const fallbackTiers: PricingTier[] = (DAILY_QUANTITY_OPTIONS as readonly any[]).map((opt) => ({
    quantityMl: opt.liters * 1000,
    label: opt.label,
    dailyPricePaise: opt.dailyRs * 100,
    largeBottleDepositPaise: 3500,
    smallBottleDepositPaise: 2500,
  }));
  return buildFromTiers(fallbackTiers);
}

/**
 * Hook to fetch live pricing from the backend.
 * Falls back to hardcoded values if the API fails.
 */
export function usePricing(): PricingData {
  const [data, setData] = useState<Omit<PricingData, 'loading'>>(() => {
    // Initialize from cache if available
    if (cachedTiers && Date.now() < cacheExpiry) {
      return buildFromTiers(cachedTiers);
    }
    return getFallback();
  });
  const [loading, setLoading] = useState(!cachedTiers || Date.now() >= cacheExpiry);

  useEffect(() => {
    // Skip if cache is still valid
    if (cachedTiers && Date.now() < cacheExpiry) {
      setData(buildFromTiers(cachedTiers));
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch(getApiUrl('/api/pricing'))
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        const tiers: PricingTier[] = json.tiers || [];
        if (tiers.length > 0) {
          cachedTiers = tiers;
          cacheExpiry = Date.now() + CACHE_TTL;
          setData(buildFromTiers(tiers));
        }
      })
      .catch(() => {
        // Keep fallback data
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { ...data, loading };
}

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache TTL (Time To Live) in milliseconds
  TTL: {
    DELIVERY_TEAM: 1 * 60 * 1000,     // FIX: 1 minute (was 1 hour) - needs real-time updates
    INVENTORY: 5 * 60 * 1000,         // 5 minutes - semi-static
    PENALTIES: 1 * 60 * 1000,         // FIX: 1 minute (was 5) - needs real-time updates
    CALENDAR: 2 * 60 * 1000,          // 2 minutes - changes with deliveries
    DEFAULT: 5 * 60 * 1000,           // 5 minutes default
  },
  // App version for cache invalidation (increment when you want to clear all caches)
  VERSION: '1.0.2',  // FIX: Incremented to invalidate old delivery-team cache with wrong type
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

/**
 * In-memory cache store (shared across all hook instances)
 * Provides faster access than localStorage
 */
const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Get cache key with version prefix
 */
function getCacheKey(key: string): string {
  return `cache_v${CACHE_CONFIG.VERSION}_${key}`;
}

/**
 * Read from cache (memory first, then localStorage)
 */
function readFromCache<T>(key: string, ttl: number): T | null {
  const cacheKey = getCacheKey(key);
  const now = Date.now();

  // Try memory cache first (fastest)
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry && memEntry.version === CACHE_CONFIG.VERSION) {
    const age = now - memEntry.timestamp;
    if (age < ttl) {
      return memEntry.data as T;
    }
    // Expired, remove from memory
    memoryCache.delete(cacheKey);
  }

  // Try localStorage (persists across page reloads)
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);

      // Check version match
      if (entry.version !== CACHE_CONFIG.VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      const age = now - entry.timestamp;
      if (age < ttl) {
        // Still valid, restore to memory cache
        memoryCache.set(cacheKey, entry);
        return entry.data;
      }

      // Expired, remove from localStorage
      localStorage.removeItem(cacheKey);
    }
  } catch (error) {
    // localStorage might be disabled or full
    console.warn('Failed to read from localStorage:', error);
  }

  return null;
}

/**
 * Write to cache (both memory and localStorage)
 */
function writeToCache<T>(key: string, data: T): void {
  const cacheKey = getCacheKey(key);
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    version: CACHE_CONFIG.VERSION,
  };

  // Write to memory cache
  memoryCache.set(cacheKey, entry);

  // Write to localStorage (for persistence)
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('Failed to write to localStorage:', error);
  }
}

/**
 * Invalidate cache entry
 */
function invalidateCache(key: string): void {
  const cacheKey = getCacheKey(key);
  memoryCache.delete(cacheKey);
  try {
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error);
  }
}

/**
 * Clear all caches (useful for logout or version changes)
 */
export function clearAllCaches(): void {
  memoryCache.clear();
  try {
    // Remove all cache entries from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear localStorage caches:', error);
  }
}

/**
 * Hook options
 */
interface UseCachedDataOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Enable/disable caching (default: true) */
  enabled?: boolean;
  /** Dependencies to trigger refetch */
  dependencies?: any[];
}

/**
 * Result from useCachedData hook
 */
interface UseCachedDataResult<T> {
  /** The cached or fetched data */
  data: T | null;
  /** Loading state (true on initial load only) */
  loading: boolean;
  /** Refreshing state (true when refetching with existing data) */
  refreshing: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch the data */
  refetch: () => void;
  /** Invalidate cache and refetch */
  invalidate: () => void;
}

/**
 * Custom hook for fetching and caching data with TTL
 *
 * Features:
 * - Memory + localStorage caching
 * - TTL-based expiration
 * - Version-based cache invalidation
 * - Manual refetch and invalidation
 * - Loading and refreshing states
 *
 * @example
 * ```typescript
 * const { data, loading, refetch } = useCachedData<DeliveryPerson[]>(
 *   'delivery-team',
 *   '/api/admin/delivery-team',
 *   { ttl: CACHE_CONFIG.TTL.DELIVERY_TEAM }
 * );
 * ```
 */
export function useCachedData<T>(
  cacheKey: string,
  url: string,
  options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const {
    ttl = CACHE_CONFIG.TTL.DEFAULT,
    enabled = true,
    dependencies = [],
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!enabled) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache first
    if (!isRefresh) {
      const cached = readFromCache<T>(cacheKey, ttl);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    // Set loading state
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const result = await response.json();

      // Update state and cache
      setData(result);
      writeToCache(cacheKey, result);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name !== 'AbortError') {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        console.error(`Error fetching ${url}:`, err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [cacheKey, url, ttl, enabled]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    invalidateCache(cacheKey);
    fetchData(true);
  }, [cacheKey, fetchData]);

  useEffect(() => {
    fetchData();

    // Cleanup: abort any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Delivery team response type
 */
interface DeliveryTeamResponse {
  totalStaff: number;
  activeToday: number;
  onRouteToday: number;
  staff: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
    mustChangePassword: boolean;
    customerCount: number;
    todayDeliveries: number;
    todayLoad: number;
    maxLoad: number;
  }>;
}

/**
 * Pre-configured hook for delivery team data
 */
export function useDeliveryTeam() {
  return useCachedData<DeliveryTeamResponse>(
    'delivery-team',
    '/api/admin/delivery-team',
    { ttl: CACHE_CONFIG.TTL.DELIVERY_TEAM }
  );
}

/**
 * Pre-configured hook for inventory data
 */
export function useInventory() {
  return useCachedData<any>(
    'inventory',
    '/api/admin/inventory',
    { ttl: CACHE_CONFIG.TTL.INVENTORY }
  );
}

/**
 * Pre-configured hook for penalties data
 */
export function usePenalties() {
  return useCachedData<any[]>(
    'penalties',
    '/api/admin/penalties',
    { ttl: CACHE_CONFIG.TTL.PENALTIES }
  );
}

/**
 * Pre-configured hook for calendar data
 * Caches calendar data by month/year
 */
export function useCalendarData(year: number, month: number) {
  return useCachedData<any>(
    `calendar_${year}_${month}`,
    `/api/customer/calendar?year=${year}&month=${month}`,
    {
      ttl: CACHE_CONFIG.TTL.CALENDAR,
      dependencies: [year, month], // Refetch when year/month changes
    }
  );
}

/**
 * Calendar-specific cache invalidation helper
 * Call this after any calendar mutation (pause, resume, modify)
 */
export function invalidateCalendarCache(year?: number, month?: number): void {
  if (year !== undefined && month !== undefined) {
    // Invalidate specific month
    const key = `calendar_${year}_${month}`;
    invalidateCache(key);
  } else {
    // Invalidate all calendar caches
    memoryCache.forEach((_, key) => {
      if (key.includes('calendar_')) {
        invalidateCache(key.replace(getCacheKey(''), ''));
      }
    });
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.includes('calendar_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clear calendar caches:', error);
    }
  }
}

export { CACHE_CONFIG };

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../config/api';

// Query keys for consistent cache management
export const deliveryKeys = {
  todayDeliveries: (date?: string) => ['deliveries', 'today', date] as const,
  assignees: ['deliveries', 'assignees'] as const,
  customerDetail: (customerId: string, date?: string) => ['deliveries', 'customer', customerId, date] as const,
  customerAction: (customerId: string, date?: string) => ['delivery-action', customerId, date] as const,
  history: (from?: string, to?: string) => ['deliveries', 'history', from, to] as const,
};

// Fetch today's deliveries with caching
export function useTodayDeliveries(date?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: deliveryKeys.todayDeliveries(date),
    queryFn: async () => {
      const url = date
        ? `/api/delivery/today?date=${date}`
        : '/api/delivery/today';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      return res.json();
    },
    staleTime: 30 * 1000, // Fresh for 30s — avoids refetch on quick back-navigation
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: true, // Refetch on mount only if stale (respects staleTime)
    refetchOnWindowFocus: false, // Don't refetch when switching apps — delivery person does this often
  });

  // Seed customer detail cache from bundled data in today's response
  // This eliminates the extra API call when tapping a customer
  useEffect(() => {
    if (!query.data?.deliveries || !date) return;
    for (const delivery of query.data.deliveries) {
      if (!delivery.customer?.id) continue;
      const actionKey = deliveryKeys.customerAction(delivery.customer.id, date);
      // Only seed if no data exists yet (don't overwrite fresher data)
      const existing = queryClient.getQueryData(actionKey);
      if (!existing) {
        queryClient.setQueryData(actionKey, {
          customer: delivery.customer,
          delivery: {
            id: delivery.id,
            deliveryDate: delivery.deliveryDate,
            quantityMl: delivery.quantityMl,
            largeBottles: delivery.largeBottles,
            smallBottles: delivery.smallBottles,
            status: delivery.status,
            deliveryNotes: delivery.deliveryNotes,
            largeBottlesCollected: delivery.largeBottlesCollected ?? 0,
            smallBottlesCollected: delivery.smallBottlesCollected ?? 0,
          },
          bottleBalance: delivery.bottleBalance ?? { large: 0, small: 0 },
          date,
        });
      }
    }
  }, [query.data, date, queryClient]);

  return query;
}

// Fetch assignees list with longer cache
export function useAssignees() {
  return useQuery({
    queryKey: deliveryKeys.assignees,
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/delivery/assignees'), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch assignees');
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes (rarely changes)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Fetch customer detail with prefetching support
export function useCustomerDetail(customerId: string, date?: string) {
  return useQuery({
    queryKey: deliveryKeys.customerDetail(customerId, date),
    queryFn: async () => {
      const url = date
        ? `/api/delivery/customer/${customerId}?date=${date}`
        : `/api/delivery/customer/${customerId}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch customer');
      return res.json();
    },
    staleTime: 3 * 60 * 1000, // Fresh for 3 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!customerId, // Only fetch if customerId exists
  });
}

// Prefetch customer detail for smooth navigation
// Checks cache first — avoids redundant API calls when data is seeded from today's bundle
export function usePrefetchCustomer() {
  const queryClient = useQueryClient();

  return (customerId: string, date?: string) => {
    // Check if we already have seeded data from the daily bundle
    const actionKey = deliveryKeys.customerAction(customerId, date);
    const existing = queryClient.getQueryData(actionKey);
    if (existing) return; // Already have data, no need to prefetch

    queryClient.prefetchQuery({
      queryKey: deliveryKeys.customerDetail(customerId, date),
      queryFn: async () => {
        const url = date
          ? `/api/delivery/customer/${customerId}?date=${date}`
          : `/api/delivery/customer/${customerId}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch customer');
        return res.json();
      },
      staleTime: 3 * 60 * 1000,
    });
  };
}

// Invalidate today's deliveries cache after marking delivery
export function useInvalidateDeliveries() {
  const queryClient = useQueryClient();

  return {
    invalidateTodayDeliveries: (date?: string) => {
      queryClient.invalidateQueries({
        queryKey: deliveryKeys.todayDeliveries(date)
      });
    },
    invalidateCustomer: (customerId: string, date?: string) => {
      queryClient.invalidateQueries({
        queryKey: deliveryKeys.customerDetail(customerId, date)
      });
    },
  };
}

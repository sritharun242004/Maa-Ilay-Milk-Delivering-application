import { useQuery, useQueryClient } from '@tanstack/react-query';

// Query keys for consistent cache management
export const deliveryKeys = {
  todayDeliveries: (date?: string) => ['deliveries', 'today', date] as const,
  assignees: ['deliveries', 'assignees'] as const,
  customerDetail: (customerId: string, date?: string) => ['deliveries', 'customer', customerId, date] as const,
  history: (from?: string, to?: string) => ['deliveries', 'history', from, to] as const,
};

// Fetch today's deliveries with caching
export function useTodayDeliveries(date?: string) {
  return useQuery({
    queryKey: deliveryKeys.todayDeliveries(date),
    queryFn: async () => {
      const url = date
        ? `/api/delivery/today?date=${date}`
        : '/api/delivery/today';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      return res.json();
    },
    staleTime: 0, // Always treat as stale so it refetches
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

// Fetch assignees list with longer cache
export function useAssignees() {
  return useQuery({
    queryKey: deliveryKeys.assignees,
    queryFn: async () => {
      const res = await fetch('/api/delivery/assignees', { credentials: 'include' });
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
export function usePrefetchCustomer() {
  const queryClient = useQueryClient();

  return (customerId: string, date?: string) => {
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

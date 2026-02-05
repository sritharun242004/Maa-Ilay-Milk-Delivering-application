import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatDateLocal, getLocalTodayISO } from '../../lib/date';
import { deliveryKeys } from '../../hooks/useDeliveryData';
import { RefreshCw } from 'lucide-react';

type DeliveryStatus = 'SCHEDULED' | 'DELIVERED' | 'NOT_DELIVERED' | 'PAUSED' | 'BLOCKED' | 'HOLIDAY';

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
}

interface HistoryRow {
  id: string;
  deliveryDate: string;
  quantityMl: number;
  status: DeliveryStatus;
  deliveryNotes: string | null;
  largeBottlesCollected?: number;
  smallBottlesCollected?: number;
  customer: CustomerInfo;
}

function quantityLabel(quantityMl: number): string {
  if (quantityMl >= 1000) return `${quantityMl / 1000}L`;
  return `${quantityMl}ml`;
}

function bottlesCollectedLabel(large?: number, small?: number): string {
  const l = typeof large === 'number' ? large : 0;
  const s = typeof small === 'number' ? small : 0;
  if (l && s) return `${l}×1L, ${s}×500ml`;
  if (l) return `${l}×1L`;
  if (s) return `${s}×500ml`;
  return '–';
}

const HISTORY_FILTER_KEY = 'deliveryHistoryFilter';

function getInitialFilter(): { from: string; to: string } {
  try {
    const raw = localStorage.getItem(HISTORY_FILTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { from?: string; to?: string };
      if (parsed.from) return { from: parsed.from, to: parsed.to ?? '' };
    }
  } catch {
    // ignore
  }
  return { from: getLocalTodayISO(), to: '' };
}

export const DeliveryHistory: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilterState] = useState(getInitialFilter);
  const from = filter.from;
  const to = filter.to;
  const setFrom = (v: string) => setFilterState((prev) => ({ ...prev, from: v }));
  const setTo = (v: string) => setFilterState((prev) => ({ ...prev, to: v }));

  // Use React Query for automatic caching and refetching
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: deliveryKeys.history(from, to),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('from', from);
      if (to.trim()) params.set('to', to.trim());
      const res = await fetch(`/api/delivery/history?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();

      // Save to localStorage
      try {
        localStorage.setItem(HISTORY_FILTER_KEY, JSON.stringify({ from, to }));
      } catch {
        // ignore
      }

      return data;
    },
    staleTime: 0, // Always refetch for fresh data
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const deliveries = data?.deliveries ?? [];

  const handleFromChange = (v: string) => setFrom(v);
  const handleToChange = (v: string) => setTo(v);

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Delivery History</h1>

        <Card className="p-6 mb-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To date (optional)</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg"
              />
            </div>
            <div className="self-end">
              <button
                onClick={() => refetch()}
                disabled={loading}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Quantity</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Bottles Collected</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-gray-500">
                      No deliveries in this range
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="border-b">
                      <td className="py-4 px-4">{formatDateLocal(d.deliveryDate, 'iso')}</td>
                      <td className="py-4 px-4 font-medium">{d.customer.name}</td>
                      <td className="py-4 px-4 font-semibold">{quantityLabel(d.quantityMl)}</td>
                      <td className="py-4 px-4 text-gray-600">{bottlesCollectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</td>
                      <td className="py-4 px-4">
                        {d.status === 'DELIVERED' && <Badge variant="success">Delivered</Badge>}
                        {d.status === 'NOT_DELIVERED' && <Badge variant="error">Not Delivered</Badge>}
                        {d.status === 'PAUSED' && <Badge variant="warning">Paused</Badge>}
                        {d.status === 'BLOCKED' && <Badge variant="error">Blocked</Badge>}
                        {d.status === 'HOLIDAY' && <Badge variant="warning">Holiday</Badge>}
                        {d.status === 'SCHEDULED' && <Badge variant="warning">Scheduled</Badge>}
                      </td>
                      <td className="py-4 px-4 text-gray-600">{d.deliveryNotes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </DeliveryLayout>
  );
};

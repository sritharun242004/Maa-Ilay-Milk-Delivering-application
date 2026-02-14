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

function StatusBadge({ status }: { status: DeliveryStatus }) {
  switch (status) {
    case 'DELIVERED': return <Badge variant="success">Delivered</Badge>;
    case 'NOT_DELIVERED': return <Badge variant="error">Not Delivered</Badge>;
    case 'PAUSED': return <Badge variant="warning">Paused</Badge>;
    case 'BLOCKED': return <Badge variant="error">Blocked</Badge>;
    case 'HOLIDAY': return <Badge variant="warning">Holiday</Badge>;
    case 'SCHEDULED': return <Badge variant="warning">Scheduled</Badge>;
    default: return null;
  }
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
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-6 sm:mb-8">Delivery History</h1>

        <Card className="p-4 sm:p-6 mb-6">
          <div className="flex gap-3 sm:gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 border-2 rounded-lg text-sm"
                required
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 border-2 rounded-lg text-sm"
              />
            </div>
            <div>
              <button
                onClick={() => refetch()}
                disabled={loading}
                className="px-4 sm:px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{loading ? 'Loading...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </Card>
        ) : deliveries.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No deliveries in this range
          </Card>
        ) : (
          <>
            {/* Desktop table view */}
            <Card className="overflow-hidden hidden sm:block">
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
                  {deliveries.map((d: HistoryRow) => (
                    <tr key={d.id} className="border-b">
                      <td className="py-4 px-4">{formatDateLocal(d.deliveryDate, 'iso')}</td>
                      <td className="py-4 px-4 font-medium">{d.customer.name}</td>
                      <td className="py-4 px-4 font-semibold">{quantityLabel(d.quantityMl)}</td>
                      <td className="py-4 px-4 text-gray-600">{bottlesCollectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</td>
                      <td className="py-4 px-4">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-4 px-4 text-gray-600">{d.deliveryNotes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {deliveries.map((d: HistoryRow) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{d.customer.name}</p>
                      <p className="text-sm text-gray-500">{formatDateLocal(d.deliveryDate, 'iso')}</p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold">{quantityLabel(d.quantityMl)}</span>
                    <span className="text-gray-500">Bottles: {bottlesCollectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">Remarks</p>
                    <p className="text-sm text-gray-700">{d.deliveryNotes || '–'}</p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DeliveryLayout>
  );
};

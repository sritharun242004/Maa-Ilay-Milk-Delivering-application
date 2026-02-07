import React, { useEffect, useState } from 'react';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatDateLocal, getLocalTodayISO } from '../../lib/date';

type DeliveryStatus = 'SCHEDULED' | 'DELIVERED' | 'NOT_DELIVERED' | 'PAUSED' | 'BLOCKED' | 'HOLIDAY';

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  deliveryNotes?: string | null;
  city?: string;
  pincode?: string;
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
  const [filter, setFilterState] = useState(getInitialFilter);
  const from = filter.from;
  const to = filter.to;
  const setFrom = (v: string) => setFilterState((prev) => ({ ...prev, from: v }));
  const setTo = (v: string) => setFilterState((prev) => ({ ...prev, to: v }));
  const [deliveries, setDeliveries] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', from);
      if (to.trim()) params.set('to', to.trim());
      const res = await fetch(`/api/delivery/history?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setDeliveries([]);
        return;
      }
      const data = await res.json();
      setDeliveries(data.deliveries ?? []);
      try {
        localStorage.setItem(HISTORY_FILTER_KEY, JSON.stringify({ from, to }));
      } catch {
        // ignore
      }
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFilter = () => loadHistory();

  const handleFromChange = (v: string) => setFrom(v);
  const handleToChange = (v: string) => setTo(v);

  // No disruptive full-page skeleton on filter changes.
  // We handle initial load inside the main render for a smoother feel.

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto relative">
        {/* Loading Overlay when filtering existing data */}
        {loading && deliveries.length > 0 && (
          <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-4 rounded-full shadow-lg">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Delivery History</h1>

        <Card className="p-6 mb-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To date (optional)</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="self-end">
              <button
                onClick={handleFilter}
                disabled={loading}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Filter'}
              </button>
            </div>
          </div>
        </Card>

        <div className={`transition-opacity duration-200 ${loading && deliveries.length > 0 ? 'opacity-50' : 'opacity-100'}`}>
          {loading && deliveries.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <Card className="p-12 text-center text-gray-500">
              No deliveries in this range
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <Card className="overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Customer Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Address</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Quantity</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Bottles Collected</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d, index) => (
                        <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4 font-semibold text-gray-900">{index + 1}</td>
                          <td className="py-4 px-4">{formatDateLocal(d.deliveryDate, 'iso')}</td>
                          <td className="py-4 px-4 font-medium">{d.customer.name}</td>
                          <td className="py-4 px-4 text-gray-600">+91 {d.customer.phone}</td>
                          <td className="py-4 px-4 text-gray-600">
                            {d.customer.addressLine1}
                            {d.customer.addressLine2 ? `, ${d.customer.addressLine2}` : ''}
                            {d.customer.landmark ? ` (${d.customer.landmark})` : ''}
                          </td>
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
                          <td className="py-4 px-4 text-gray-600 max-w-[200px] truncate">{d.deliveryNotes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile List View */}
              <div className="space-y-4 md:hidden">
                {deliveries.map((d) => (
                  <Card key={d.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{formatDateLocal(d.deliveryDate, 'iso')}</p>
                        <h3 className="font-bold text-gray-900">{d.customer.name}</h3>
                        <p className="text-sm text-gray-600">{d.customer.addressLine1}</p>
                      </div>
                      {/* Status Badge */}
                      <div className="scale-90 origin-top-right">
                        {d.status === 'DELIVERED' && <Badge variant="success">Delivered</Badge>}
                        {d.status === 'NOT_DELIVERED' && <Badge variant="error">Not Delivered</Badge>}
                        {d.status === 'PAUSED' && <Badge variant="warning">Paused</Badge>}
                        {d.status === 'BLOCKED' && <Badge variant="error">Blocked</Badge>}
                        {d.status === 'HOLIDAY' && <Badge variant="warning">Holiday</Badge>}
                        {d.status === 'SCHEDULED' && <Badge variant="warning">Scheduled</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-2">
                      <div>
                        <span className="block text-xs text-gray-500">Quantity</span>
                        <span className="font-medium text-gray-900">{quantityLabel(d.quantityMl)}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">Collected</span>
                        <span className="font-medium text-gray-900">{bottlesCollectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</span>
                      </div>
                    </div>
                    {d.deliveryNotes && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <span className="block text-xs text-gray-500">Remarks</span>
                        <p className="text-gray-700">{d.deliveryNotes}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DeliveryLayout>
  );
};

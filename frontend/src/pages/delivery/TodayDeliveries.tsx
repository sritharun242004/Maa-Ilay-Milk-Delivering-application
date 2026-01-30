import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CheckCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

type DeliveryStatus = 'SCHEDULED' | 'DELIVERED' | 'NOT_DELIVERED' | 'PAUSED' | 'BLOCKED' | 'HOLIDAY';

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  zone: string | null;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
}

interface DeliveryRow {
  id: string;
  customerId: string;
  deliveryDate: string;
  quantityMl: number;
  largeBottles: number;
  smallBottles: number;
  status: DeliveryStatus;
  largeBottlesCollected?: number;
  smallBottlesCollected?: number;
  customer: CustomerInfo;
}

interface TodayResponse {
  date: string;
  total: number;
  completed: number;
  pending: number;
  totalLiters?: number;
  total1LBottles?: number;
  total500mlBottles?: number;
  deliveries: DeliveryRow[];
}

function quantityLabel(quantityMl: number): string {
  if (quantityMl >= 1000) return `${quantityMl / 1000}L`;
  return `${quantityMl}ml`;
}

function collectedLabel(large?: number, small?: number): string {
  const l = typeof large === 'number' ? large : 0;
  const s = typeof small === 'number' ? small : 0;
  if (l && s) return `${l}×1L, ${s}×500ml`;
  if (l) return `${l}×1L`;
  if (s) return `${s}×500ml`;
  return '–';
}

function statusBadge(status: DeliveryStatus) {
  switch (status) {
    case 'DELIVERED':
      return <Badge variant="success">Delivered</Badge>;
    case 'NOT_DELIVERED':
      return <Badge variant="error">Not Delivered</Badge>;
    case 'PAUSED':
      return <Badge variant="warning">Paused</Badge>;
    case 'BLOCKED':
      return <Badge variant="error">Blocked</Badge>;
    case 'HOLIDAY':
      return <Badge variant="warning">Holiday</Badge>;
    default:
      return <Badge variant="warning">Pending</Badge>;
  }
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const TodayDeliveries: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DeliveryPerson | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateString(new Date()));

  useEffect(() => {
    let cancelled = false;
    fetch('/api/delivery/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((meData) => {
        if (!cancelled) setProfile(meData);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load profile');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    setError(null);
    fetch(`/api/delivery/today?date=${selectedDate}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load deliveries');
        return res.json();
      })
      .then((data) => setToday(data))
      .catch(() => setError('Failed to load deliveries'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (loading) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </DeliveryLayout>
    );
  }

  if (!profile) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto py-8">
          <p className="text-red-600">{error || 'Failed to load profile'}</p>
        </div>
      </DeliveryLayout>
    );
  }

  const deliveries = today?.deliveries ?? [];

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto">
        <Card className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-emerald-100 mb-1">Date</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(toDateString(d));
                  }}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="text-2xl font-bold min-w-[200px]">
                  {loading ? '...' : formatDateLong(selectedDate)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(toDateString(d));
                  }}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label="Next day"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <p className="text-emerald-100 mt-4">Delivery Person</p>
              <p className="text-xl font-semibold">{profile.name}</p>
              <p className="text-emerald-100">
                +91 {profile.phone} {profile.zone ? `• ${profile.zone}` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-emerald-100 text-sm">Liters (to load)</p>
                  <p className="text-2xl font-bold">{typeof today?.totalLiters === 'number' ? today.totalLiters : 0}L</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">1L bottles</p>
                  <p className="text-2xl font-bold">{today?.total1LBottles ?? 0}</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">500ml bottles</p>
                  <p className="text-2xl font-bold">{today?.total500mlBottles ?? 0}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-emerald-100 text-sm">Total</p>
                  <p className="text-2xl font-bold">{today?.total ?? 0}</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Completed</p>
                  <p className="text-2xl font-bold">{today?.completed ?? 0}</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Pending</p>
                  <p className="text-2xl font-bold">{today?.pending ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Customer Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Phone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Address</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Collected</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 px-4 text-center text-gray-500">
                      No deliveries for this date
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d, index) => (
                    <tr
                      key={d.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/delivery/customer/${d.customer.id}`, { state: { date: selectedDate } })}
                    >
                      <td className="py-4 px-4 font-semibold text-gray-900">{index + 1}</td>
                      <td className="py-4 px-4 font-medium">{d.customer.name}</td>
                      <td className="py-4 px-4 text-gray-600">+91 {d.customer.phone}</td>
                      <td className="py-4 px-4 text-gray-600">
                        {d.customer.addressLine1}
                        {d.customer.addressLine2 ? `, ${d.customer.addressLine2}` : ''}
                        {d.customer.landmark ? ` (${d.customer.landmark})` : ''}
                      </td>
                      <td className="py-4 px-4 font-semibold">
                        {d.largeBottles && d.smallBottles
                          ? `${d.largeBottles}L + ${d.smallBottles}×500ml`
                          : d.largeBottles
                            ? `${d.largeBottles}L`
                            : d.smallBottles
                              ? `${d.smallBottles}×500ml`
                              : quantityLabel(d.quantityMl)}
                      </td>
                      <td className="py-4 px-4 font-semibold">{quantityLabel(d.quantityMl)}</td>
                      <td className="py-4 px-4 text-gray-600">{collectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</td>
                      <td className="py-4 px-4">{statusBadge(d.status)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/delivery/customer/${d.customer.id}`, { state: { date: selectedDate } });
                            }}
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/delivery/customer/${d.customer.id}`);
                            }}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DeliveryLayout>
  );
};

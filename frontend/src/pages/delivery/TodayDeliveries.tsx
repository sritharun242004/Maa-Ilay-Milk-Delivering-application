import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CheckCircle, Eye, ChevronLeft, ChevronRight, Phone, MapPin, Package } from 'lucide-react';

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
  deliveryNotes?: string | null;
  city?: string;
  pincode?: string;
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
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load profile once
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

  // Cache for loaded dates to make navigation seamless
  const cache = React.useRef<Map<string, TodayResponse>>(new Map());

  // Load deliveries with optimized fetching and caching
  useEffect(() => {
    if (!selectedDate) return;

    // Check cache first
    if (cache.current.has(selectedDate)) {
      setToday(cache.current.get(selectedDate)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    // Don't clear 'today' immediately to avoid flash if we want to show stale data,
    // but here we want to show a loading skeleton for the *new* date, so we can clear it 
    // or handle it in the render. Let's clear it so we show the skeleton for the content area.
    setToday(null);
    setError(null);

    fetch(`/api/delivery/today?date=${selectedDate}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load deliveries');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          cache.current.set(selectedDate, data);
          setToday(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load deliveries');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const handleCustomerClick = useCallback((customer: CustomerInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  }, []);

  const deliveries = useMemo(() => today?.deliveries ?? [], [today?.deliveries]);

  // Render content
  const renderContent = () => {
    if (loading && !today) {
      return (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl border border-gray-200"></div>
          ))}
        </div>
      );
    }

    if (deliveries.length === 0) {
      return (
        <Card className="p-12 text-center text-gray-500">
          No deliveries for this date
        </Card>
      );
    }

    return (
      <>
        {/* Desktop Table View */}
        <Card className="overflow-hidden hidden md:block">
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
                {deliveries.map((d, index) => (
                  <tr
                    key={d.id}
                    className="border-b hover:bg-emerald-50 transition-colors"
                  >
                    <td className="py-4 px-4 font-semibold text-gray-900">{index + 1}</td>
                    <td
                      className="py-4 px-4 font-medium cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={(e) => handleCustomerClick(d.customer, e)}
                      title="Click to view full customer details"
                    >
                      {d.customer.name}
                    </td>
                    <td
                      className="py-4 px-4 text-gray-600 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={(e) => handleCustomerClick(d.customer, e)}
                    >
                      +91 {d.customer.phone}
                    </td>
                    <td
                      className="py-4 px-4 text-gray-600 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={(e) => handleCustomerClick(d.customer, e)}
                    >
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
                          onClick={(e) => handleCustomerClick(d.customer, e)}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile List View */}
        <div className="space-y-4 md:hidden">
          {deliveries.map((d) => (
            <Card key={d.id} className="p-4" onClick={(e) => handleCustomerClick(d.customer, e)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{d.customer.name}</h3>
                  <p className="text-sm text-gray-600">{d.customer.addressLine1}</p>
                </div>
                {statusBadge(d.status)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                <div>
                  <span className="block text-xs text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900">{quantityLabel(d.quantityMl)}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">Collected</span>
                  <span className="font-medium text-gray-900">{collectedLabel(d.largeBottlesCollected, d.smallBottlesCollected)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <button
                  className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-medium text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/delivery/customer/${d.customer.id}`, { state: { date: selectedDate } });
                  }}
                >
                  Update Status
                </button>
                <button
                  className="p-2 bg-gray-100 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCustomerClick(d.customer, e);
                  }}
                >
                  <Eye className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  };

  if (!profile) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto py-8">
          <p className="text-red-600">{error || 'Failed to load profile'}</p>
        </div>
      </DeliveryLayout>
    );
  }

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto relative">
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
                  {formatDateLong(selectedDate)}
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

        {renderContent()}

        {/* Customer Details Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Customer Details"
          size="lg"
        >
          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Package className="w-4 h-4" />
                      <span>Customer Name</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Phone className="w-4 h-4" />
                      <span>Phone Number</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">+91 {selectedCustomer.phone}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span>Full Address</span>
                    </div>
                    <div className="text-gray-900">
                      <p className="font-semibold">{selectedCustomer.addressLine1 || 'No address provided'}</p>
                      {selectedCustomer.addressLine2 && (
                        <p className="text-gray-700">{selectedCustomer.addressLine2}</p>
                      )}
                      {selectedCustomer.landmark && (
                        <p className="text-gray-600 italic">Landmark: {selectedCustomer.landmark}</p>
                      )}
                      {(selectedCustomer.city || selectedCustomer.pincode) && (
                        <p className="text-gray-600">
                          {selectedCustomer.city || ''} {selectedCustomer.pincode || ''}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedCustomer.deliveryNotes && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Special Delivery Instructions</p>
                      <p className="text-blue-800">{selectedCustomer.deliveryNotes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    navigate(`/delivery/customer/${selectedCustomer.id}`, { state: { date: selectedDate } });
                  }}
                  className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                >
                  Mark Delivery Status
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DeliveryLayout>
  );
};

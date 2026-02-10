import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Search, MoreVertical, User, X, Calendar, Wallet, Package, Receipt, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatDateLocal } from '../../lib/date';
import { useDeliveryTeam } from '../../hooks/useCachedData';
import { fetchWithCsrf } from '../../utils/csrf';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  walletBalanceRs: string;
  plan: string;
  status: string;
  deliveryPersonId: string | null;
  deliveryPersonName: string;
};

type CustomerDetail = {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    landmark: string | null;
    city: string;
    pincode: string;
    status: string;
    deliveryNotes: string | null;
    approvedAt: string | null;
    deliveryPerson: { id: string; name: string } | null;
  };
  wallet: { balancePaise: number; balanceRs: string } | null;
  lastTransaction: {
    id: string;
    type: string;
    amountPaise: number;
    amountRs: string;
    description: string;
    createdAt: string;
  } | null;
  subscription: {
    dailyQuantityMl: number;
    dailyPricePaise: number;
    status: string;
    largeBottles: number;
    smallBottles: number;
  } | null;
  bottleBalance: { large: number; small: number };
  calendar: {
    year: number;
    month: number;
    pausedDates: string[];
    modificationsByDate: Record<string, { quantityMl: number; largeBottles: number; smallBottles: number; notes: string | null }>;
    deliveryStatusByDate: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED' | 'SCHEDULED'>;
  };
};

type StaffRow = { id: string; name: string; phone: string };

export const AdminCustomers: React.FC = () => {
  // Use cached delivery team data
  const { data: deliveryTeamData } = useDeliveryTeam();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const CUSTOMERS_CACHE_KEY = 'admin_customers_cache';
  const CACHE_MAX_AGE_MS = 60 * 1000; // 1 min
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reassignCustomer, setReassignCustomer] = useState<CustomerRow | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [reassignPersonId, setReassignPersonId] = useState('');
  const [deliveryStartDate, setDeliveryStartDate] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<any>(null);
  const [deliveryDetailsLoading, setDeliveryDetailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const fetchCustomers = useCallback((showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const cacheKey = `${CUSTOMERS_CACHE_KEY}_${params.toString()}`;
    fetch(`/api/admin/customers?${params}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load customers');
        return res.json();
      })
      .then((data) => {
        const list = data.customers ?? [];
        setCustomers(list);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: list, at: Date.now() }));
        } catch {
          // ignore
        }
      })
      .catch(() => setError('Could not load customers'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const cacheKey = `${CUSTOMERS_CACHE_KEY}_${params.toString()}`;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const { data: cached, at } = JSON.parse(raw) as { data: CustomerRow[]; at: number };
        if (cached?.length !== undefined && Date.now() - at < CACHE_MAX_AGE_MS) {
          setCustomers(cached);
          setLoading(false);
          setError(null);
          fetchCustomers(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    fetchCustomers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    if (!menuOpenId) {
      setMenuAnchor(null);
      return;
    }
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpenId(null);
        setMenuAnchor(null);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpenId]);

  useEffect(() => {
    if (!detailCustomerId) {
      setDetailData(null);
      return;
    }
    // Reset calendar to current month when opening a customer profile
    const now = new Date();
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, [detailCustomerId]);

  useEffect(() => {
    if (!detailCustomerId) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    setDetailData(null);
    const params = new URLSearchParams();
    params.set('year', calendarMonth.year.toString());
    params.set('month', calendarMonth.month.toString());
    fetch(`/api/admin/customers/${detailCustomerId}?${params}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load customer');
        return res.json();
      })
      .then(setDetailData)
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailCustomerId, calendarMonth]);

  useEffect(() => {
    if (!reassignCustomer) return;
    // Use cached delivery team data instead of fetching
    if (deliveryTeamData) {
      setStaffList(deliveryTeamData.staff ?? []);
    }
    setReassignPersonId(reassignCustomer.deliveryPersonId ?? '');
    // Set default start date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDeliveryStartDate(tomorrow.toISOString().split('T')[0]);
  }, [reassignCustomer, deliveryTeamData]);

  useEffect(() => {
    if (!selectedDeliveryDate || !detailCustomerId) {
      setDeliveryDetails(null);
      return;
    }
    setDeliveryDetailsLoading(true);
    setDeliveryDetails(null);
    fetch(`/api/admin/customers/${detailCustomerId}/delivery/${selectedDeliveryDate}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load delivery details');
        return res.json();
      })
      .then((data) => setDeliveryDetails(data.delivery))
      .catch(() => setDeliveryDetails(null))
      .finally(() => setDeliveryDetailsLoading(false));
  }, [selectedDeliveryDate, detailCustomerId]);

  const handleReassignSubmit = () => {
    if (!reassignCustomer) return;
    setReassignSubmitting(true);
    const body: any = reassignPersonId ? { deliveryPersonId: reassignPersonId } : { deliveryPersonId: null };
    // Include start date if delivery person is being assigned
    if (reassignPersonId && deliveryStartDate) {
      body.deliveryStartDate = deliveryStartDate;
    }
    fetchWithCsrf(`/api/admin/customers/${reassignCustomer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error || 'Failed')));
        fetchCustomers(true);
        setReassignCustomer(null);
      })
      .catch((err) => alert(err?.message || 'Failed to reassign'))
      .finally(() => setReassignSubmitting(false));
  };

  const statusVariant = (s: string) =>
    s === 'ACTIVE' ? 'success' :
    s === 'PENDING_APPROVAL' ? 'warning' :
    s === 'VISITOR' ? 'default' :
    s === 'INACTIVE' ? 'default' :
    s === 'PAUSED' ? 'warning' : 'default';
  const statusLabel = (s: string) =>
    s === 'VISITOR' ? 'Visitor' :
    s === 'PENDING_APPROVAL' ? 'Pending Approval' :
    s === 'ACTIVE' ? 'Active' :
    s === 'INACTIVE' ? 'Inactive' :
    s === 'PAUSED' ? 'Paused' :
    s.replace(/_/g, ' ');

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Customers</h1>
            <p className="text-gray-600">Manage customer subscriptions. Click a row to view full profile.</p>
          </div>
          <button
            onClick={() => {
              setExporting(true);
              const params = new URLSearchParams();
              if (search) params.set('search', search);
              if (statusFilter !== 'all') params.set('status', statusFilter);
              fetch(`/api/admin/customers-export?${params.toString()}`, { credentials: 'include' })
                .then((res) => {
                  if (!res.ok) throw new Error('Export failed');
                  return res.blob();
                })
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'customers.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => alert('Failed to export customers'))
                .finally(() => setExporting(false));
            }}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="VISITOR">Visitor</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading customers...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Customer Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Phone
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Plan
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Wallet
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">
                      Delivery Person
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase w-14">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-gray-200 hover:bg-green-50/50 cursor-pointer transition-colors"
                      onClick={() => setDetailCustomerId(customer.id)}
                    >
                      <td className="py-4 px-4 font-medium text-gray-900">{customer.name}</td>
                      <td className="py-4 px-4 text-gray-600">{customer.phone}</td>
                      <td className="py-4 px-4 font-semibold">{customer.plan}</td>
                      <td className="py-4 px-4 font-medium text-gray-900">
                        ₹{Number(customer.walletBalanceRs).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={statusVariant(customer.status) as any}>
                          {statusLabel(customer.status)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-700">{customer.deliveryPersonName}</td>
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block" ref={menuOpenId === customer.id ? menuRef : undefined}>
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              if (menuOpenId === customer.id) {
                                setMenuOpenId(null);
                                setMenuAnchor(null);
                              } else {
                                setMenuOpenId(customer.id);
                                setMenuAnchor({ x: rect.right, y: rect.top });
                              }
                            }}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && customers.length === 0 && (
            <div className="p-12 text-center text-gray-500">No customers found</div>
          )}
        </Card>
      </div>

      {/* Actions menu in portal so it is never clipped (e.g. at bottom of table) */}
      {menuOpenId && menuAnchor && (() => {
        const customer = customers.find((c) => c.id === menuOpenId);
        if (!customer) return null;
        return createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] py-1 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px]"
            style={{
              top: menuAnchor.y - 8,
              left: menuAnchor.x,
              transform: 'translate(-100%, -100%)',
            }}
          >
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                setDetailCustomerId(customer.id);
                setMenuOpenId(null);
                setMenuAnchor(null);
              }}
            >
              <User className="w-4 h-4" /> View profile
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                setReassignCustomer(customer);
                setMenuOpenId(null);
                setMenuAnchor(null);
              }}
            >
              <Package className="w-4 h-4" /> Reassign delivery person
            </button>
          </div>,
          document.body
        );
      })()}

      {/* Customer detail panel (slide-over) */}
      {detailCustomerId && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setDetailCustomerId(null)}
          role="dialog"
          aria-label="Customer profile"
        >
          <div
            className="w-full max-w-lg bg-white shadow-sm overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Customer Profile</h2>
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setDetailCustomerId(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {detailLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!detailLoading && detailData && (
                <div className="space-y-6">
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-green-800" /> Personal info
                    </h3>
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      <div><dt className="text-gray-500">Name</dt><dd className="font-medium">{detailData.customer.name}</dd></div>
                      <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{detailData.customer.email}</dd></div>
                      <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{detailData.customer.phone}</dd></div>
                      <div><dt className="text-gray-500">Address</dt><dd className="font-medium">{detailData.customer.addressLine1}{detailData.customer.addressLine2 ? `, ${detailData.customer.addressLine2}` : ''}, {detailData.customer.city} {detailData.customer.pincode}</dd></div>
                      {detailData.customer.deliveryNotes && <div><dt className="text-gray-500">Delivery notes</dt><dd className="font-medium">{detailData.customer.deliveryNotes}</dd></div>}
                      <div><dt className="text-gray-500">Assigned delivery person</dt><dd className="font-medium">{detailData.customer.deliveryPerson?.name ?? '—'}</dd></div>
                      <div><dt className="text-gray-500">Customer onboarded date</dt><dd className="font-medium">{detailData.customer.approvedAt ? new Date(detailData.customer.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
                    </dl>
                  </Card>
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-green-800" /> Wallet
                    </h3>
                    <p className="text-2xl font-bold text-green-800">₹{detailData.wallet?.balanceRs ?? '0.00'}</p>
                    {detailData.lastTransaction && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Last transaction</p>
                        <p className="text-sm font-medium">{detailData.lastTransaction.description}</p>
                        <p className="text-sm text-gray-600">{detailData.lastTransaction.amountPaise >= 0 ? '+' : ''}₹{detailData.lastTransaction.amountRs} · {formatDateLocal(detailData.lastTransaction.createdAt, 'short')}</p>
                      </div>
                    )}
                  </Card>
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-green-800" /> Subscription
                    </h3>
                    {detailData.subscription ? (
                      <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div><dt className="text-gray-500">Daily quantity</dt><dd className="font-medium">{detailData.subscription.dailyQuantityMl >= 1000 ? `${detailData.subscription.dailyQuantityMl / 1000}L` : `${detailData.subscription.dailyQuantityMl}ml`}</dd></div>
                        <div><dt className="text-gray-500">Status</dt><dd><Badge variant="success">{detailData.subscription.status}</Badge></dd></div>
                        <div><dt className="text-gray-500">Empty bottles with customer</dt><dd className="font-medium">{detailData.bottleBalance.large} × 1L, {detailData.bottleBalance.small} × 500ml</dd></div>
                      </dl>
                    ) : (
                      <p className="text-gray-500 text-sm">No active subscription</p>
                    )}
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-800" /> Delivery Calendar
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const prevMonth = calendarMonth.month - 1;
                            const prevYear = prevMonth < 0 ? calendarMonth.year - 1 : calendarMonth.year;
                            const newMonth = prevMonth < 0 ? 11 : prevMonth;
                            setCalendarMonth({ year: prevYear, month: newMonth });
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Previous month"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                          {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const nextMonth = calendarMonth.month + 1;
                            const nextYear = nextMonth > 11 ? calendarMonth.year + 1 : calendarMonth.year;
                            const newMonth = nextMonth > 11 ? 0 : nextMonth;
                            setCalendarMonth({ year: nextYear, month: newMonth });
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Next month"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Paused dates: {detailData.calendar.pausedDates.length ? detailData.calendar.pausedDates.join(', ') : 'None'}</p>
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                        <div key={d} className="text-center font-medium text-gray-500">{d}</div>
                      ))}
                      {(() => {
                        const y = detailData.calendar.year;
                        const m = detailData.calendar.month;
                        const first = new Date(y, m, 1).getDay();
                        const days = new Date(y, m + 1, 0).getDate();
                        const statusByDate = detailData.calendar.deliveryStatusByDate;
                        const cells: React.ReactNode[] = [];
                        for (let i = 0; i < first; i++) cells.push(<div key={`e-${i}`} />);
                        for (let d = 1; d <= days; d++) {
                          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const status = statusByDate[dateStr];
                          const mod = detailData.calendar.modificationsByDate?.[dateStr];

                          let bg = 'bg-gray-100 text-gray-600';
                          let title = `Day ${d}`;
                          const isClickable = status === 'DELIVERED' || status === 'NOT_DELIVERED' || status === 'PAUSED';

                          if (status === 'DELIVERED') bg = 'bg-green-200 text-green-900';
                          else if (status === 'PAUSED') bg = 'bg-orange-200 text-orange-800';
                          else if (status === 'NOT_DELIVERED') bg = 'bg-red-200 text-red-800';
                          else if (mod) bg = 'bg-blue-200 text-blue-800';

                          if (mod) title += ` (Modified: ${mod.quantityMl}ml)`;
                          if (isClickable) title += ' (Click to view details)';

                          cells.push(
                            <div
                              key={`d-${d}`}
                              className={`aspect-square rounded flex items-center justify-center font-medium ${bg} relative ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-green-500 transition-all' : ''}`}
                              title={title}
                              onClick={isClickable ? () => setSelectedDeliveryDate(dateStr) : undefined}
                            >
                              {d}
                              {mod && <div className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-blue-600 rounded-full" />}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </Card>
                </div>
              )}
              {!detailLoading && !detailData && (
                <p className="text-gray-500 py-8 text-center">Could not load customer details.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign delivery person modal */}
      {reassignCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Reassign delivery person</h2>
            <p className="text-sm text-gray-600 mb-4">Customer: <strong>{reassignCustomer.name}</strong></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery person</label>
              <select
                value={reassignPersonId}
                onChange={(e) => setReassignPersonId(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 outline-none"
              >
                <option value="">— Unassign —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                ))}
              </select>
            </div>
            {reassignPersonId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Start delivery from</label>
                <input
                  type="date"
                  value={deliveryStartDate}
                  onChange={(e) => setDeliveryStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">First delivery will be scheduled on this date</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setReassignCustomer(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleReassignSubmit} disabled={reassignSubmitting}>
                {reassignSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delivery details modal */}
      {selectedDeliveryDate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDeliveryDate(null)}
        >
          <Card
            className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Delivery Details</h2>
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setSelectedDeliveryDate(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deliveryDetailsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!deliveryDetailsLoading && deliveryDetails && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium mb-1">Date</p>
                  <p className="text-lg font-bold text-green-950">
                    {new Date(selectedDeliveryDate + 'T12:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium mb-1">Quantity</p>
                    <p className="text-2xl font-bold text-blue-900">{deliveryDetails.liters}L</p>
                    <p className="text-xs text-blue-600 mt-1">{deliveryDetails.quantityMl}ml</p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-700 font-medium mb-1">Bottles</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {deliveryDetails.largeBottles + deliveryDetails.smallBottles}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {deliveryDetails.largeBottles} × 1L, {deliveryDetails.smallBottles} × 500ml
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 font-medium mb-2">Delivered By</p>
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-400" />
                    <p className="text-lg font-bold text-gray-900">{deliveryDetails.deliveryPersonName}</p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 font-medium mb-2">Status</p>
                  <Badge variant={
                    deliveryDetails.status === 'DELIVERED' ? 'success' :
                    deliveryDetails.status === 'PAUSED' ? 'warning' :
                    'default'
                  }>
                    {deliveryDetails.status}
                  </Badge>
                </div>

                {deliveryDetails.status === 'DELIVERED' && (
                  <>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-orange-700 font-medium mb-2">Bottles Collected</p>
                      <p className="text-lg font-bold text-orange-900">
                        {deliveryDetails.largeBottlesCollected} × 1L, {deliveryDetails.smallBottlesCollected} × 500ml
                      </p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 font-medium mb-2">Amount Charged</p>
                      <p className="text-2xl font-bold text-green-950">₹{deliveryDetails.chargeRs}</p>
                    </div>

                    {deliveryDetails.deliveredAt && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 font-medium mb-2">Delivered At</p>
                        <p className="text-sm text-gray-900">
                          {formatDateLocal(deliveryDetails.deliveredAt, 'long')}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!deliveryDetailsLoading && !deliveryDetails && (
              <div className="py-8 text-center">
                <p className="text-gray-500">Could not load delivery details for this date.</p>
              </div>
            )}

            <div className="mt-6">
              <Button variant="secondary" className="w-full" onClick={() => setSelectedDeliveryDate(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

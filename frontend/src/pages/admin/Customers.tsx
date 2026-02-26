import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Search, MoreVertical, User, X, Calendar, Wallet, Package, Receipt, ChevronLeft, ChevronRight, Download, PenLine } from 'lucide-react';
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
    deliveryCount: number;
    lastDepositAtDelivery: number;
  } | null;
  monthlyPayment: {
    year: number;
    month: number;
    totalCostRs: string;
    amountDueRs: string;
    amountPaidRs: string;
    status: string;
    paidAt: string | null;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const [editLargeCollected, setEditLargeCollected] = useState(0);
  const [editSmallCollected, setEditSmallCollected] = useState(0);
  const [deliveryUpdating, setDeliveryUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [walletAdjustOpen, setWalletAdjustOpen] = useState(false);
  const [walletAdjustMode, setWalletAdjustMode] = useState<'add' | 'deduct'>('add');
  const [walletAdjustAmount, setWalletAdjustAmount] = useState('');
  const [walletAdjustDesc, setWalletAdjustDesc] = useState('');
  const [walletAdjustSubmitting, setWalletAdjustSubmitting] = useState(false);
  const [editDeliveryCount, setEditDeliveryCount] = useState('');
  const [deliveryCountUpdating, setDeliveryCountUpdating] = useState(false);
  const [deliveryCountEditOpen, setDeliveryCountEditOpen] = useState(false);

  // Debounce search input — wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback((showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
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
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
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
  }, [debouncedSearch, statusFilter]);

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

  // Track calendar year/month as primitives to avoid unnecessary re-renders
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    if (!detailCustomerId) {
      setDetailData(null);
      return;
    }
    // Reset calendar to current month when opening a new customer profile
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  }, [detailCustomerId]);

  useEffect(() => {
    if (!detailCustomerId) return;
    setDetailLoading(true);
    setDetailData(null);
    const params = new URLSearchParams();
    params.set('year', calYear.toString());
    params.set('month', calMonth.toString());
    fetch(`/api/admin/customers/${detailCustomerId}?${params}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load customer');
        return res.json();
      })
      .then(setDetailData)
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailCustomerId, calYear, calMonth]);

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
      .then((data) => {
        setDeliveryDetails(data.delivery);
        setEditLargeCollected(data.delivery?.largeBottlesCollected ?? 0);
        setEditSmallCollected(data.delivery?.smallBottlesCollected ?? 0);
      })
      .catch(() => setDeliveryDetails(null))
      .finally(() => setDeliveryDetailsLoading(false));
  }, [selectedDeliveryDate, detailCustomerId]);

  const refreshCustomerDetail = useCallback(() => {
    if (!detailCustomerId) return;
    const params = new URLSearchParams();
    params.set('year', calYear.toString());
    params.set('month', calMonth.toString());
    fetch(`/api/admin/customers/${detailCustomerId}?${params}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setDetailData(data); })
      .catch(() => {});
  }, [detailCustomerId, calYear, calMonth]);

  const handleDeliveryUpdate = (newStatus?: string) => {
    if (!deliveryDetails?.id) return;
    setDeliveryUpdating(true);
    const body: any = {};
    if (newStatus) body.status = newStatus;
    body.largeBottlesCollected = editLargeCollected;
    body.smallBottlesCollected = editSmallCollected;
    fetchWithCsrf(`/api/admin/deliveries/${deliveryDetails.id}/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error || 'Failed')));
        return res.json();
      })
      .then((data) => {
        if (data.warning) alert(data.warning);
        setSelectedDeliveryDate(null);
        // Update customer list row wallet balance in-place
        if (data.walletBalanceRs && detailCustomerId) {
          setCustomers(prev => prev.map(c =>
            c.id === detailCustomerId ? { ...c, walletBalanceRs: data.walletBalanceRs } : c
          ));
        }
        // Refresh customer detail panel in-place (no unmount/remount)
        refreshCustomerDetail();
      })
      .catch((err) => alert(err?.message || 'Failed to update delivery'))
      .finally(() => setDeliveryUpdating(false));
  };

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

  const handleWalletAdjust = () => {
    if (!detailCustomerId) return;
    const raw = parseFloat(walletAdjustAmount);
    if (isNaN(raw) || raw <= 0) { alert('Enter a valid amount greater than 0'); return; }
    if (!walletAdjustDesc.trim()) { alert('Enter a description'); return; }
    const amountRs = walletAdjustMode === 'deduct' ? -raw : raw;
    setWalletAdjustSubmitting(true);
    fetchWithCsrf(`/api/admin/customers/${detailCustomerId}/adjust-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountRs, description: walletAdjustDesc.trim() }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error || 'Failed')));
        return res.json();
      })
      .then((data) => {
        // Update detail data in-place
        if (detailData && data.wallet) {
          setDetailData({
            ...detailData,
            wallet: data.wallet,
            lastTransaction: data.transaction ?? detailData.lastTransaction,
          });
        }
        // Update wallet in customer list row in-place (no full refetch)
        if (data.wallet && detailCustomerId) {
          setCustomers(prev => prev.map(c =>
            c.id === detailCustomerId ? { ...c, walletBalanceRs: data.wallet.balanceRs } : c
          ));
        }
        setWalletAdjustOpen(false);
        setWalletAdjustAmount('');
        setWalletAdjustDesc('');
      })
      .catch((err) => alert(err?.message || 'Failed to adjust wallet'))
      .finally(() => setWalletAdjustSubmitting(false));
  };

  const handleDeliveryCountUpdate = () => {
    if (!detailCustomerId) return;
    const count = parseInt(editDeliveryCount);
    if (isNaN(count) || count < 0) { alert('Enter a valid non-negative number'); return; }
    setDeliveryCountUpdating(true);
    fetchWithCsrf(`/api/admin/customers/${detailCustomerId}/delivery-count`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryCount: count }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error || 'Failed')));
        return res.json();
      })
      .then((data) => {
        // Update detail data in-place
        if (detailData?.subscription) {
          setDetailData({
            ...detailData,
            subscription: { ...detailData.subscription, deliveryCount: data.deliveryCount },
          });
        }
        setDeliveryCountEditOpen(false);
      })
      .catch((err) => alert(err?.message || 'Failed to update delivery count'))
      .finally(() => setDeliveryCountUpdating(false));
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
              if (debouncedSearch) params.set('search', debouncedSearch);
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-green-800" /> Wallet
                      </h3>
                      <button
                        type="button"
                        onClick={() => { setWalletAdjustOpen(!walletAdjustOpen); setWalletAdjustMode('add'); setWalletAdjustAmount(''); setWalletAdjustDesc(''); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <PenLine className="w-3.5 h-3.5" /> Adjust
                      </button>
                    </div>
                    <p className="text-2xl font-bold text-green-800">₹{detailData.wallet?.balanceRs ?? '0.00'}</p>
                    {walletAdjustOpen && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                        <div className="flex rounded-lg overflow-hidden border border-gray-200">
                          <button
                            type="button"
                            onClick={() => setWalletAdjustMode('add')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${walletAdjustMode === 'add' ? 'bg-green-800 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                          >
                            + Add Money
                          </button>
                          <button
                            type="button"
                            onClick={() => setWalletAdjustMode('deduct')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${walletAdjustMode === 'deduct' ? 'bg-red-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                          >
                            - Deduct Money
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={walletAdjustAmount}
                            onChange={(e) => setWalletAdjustAmount(e.target.value)}
                            placeholder="e.g. 100"
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none ${walletAdjustMode === 'deduct' ? 'border-red-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-gray-200 focus:border-green-800 focus:ring-1 focus:ring-green-800/20'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Description</label>
                          <input
                            type="text"
                            value={walletAdjustDesc}
                            onChange={(e) => setWalletAdjustDesc(e.target.value)}
                            placeholder={walletAdjustMode === 'add' ? 'e.g. Refund for missed delivery' : 'e.g. Penalty for damaged bottle'}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                          />
                        </div>
                        {walletAdjustAmount && parseFloat(walletAdjustAmount) > 0 && (
                          <p className={`text-xs font-medium ${walletAdjustMode === 'deduct' ? 'text-red-600' : 'text-green-700'}`}>
                            {walletAdjustMode === 'deduct' ? '−' : '+'}₹{parseFloat(walletAdjustAmount).toFixed(2)} will be {walletAdjustMode === 'deduct' ? 'deducted from' : 'added to'} wallet
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setWalletAdjustOpen(false)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleWalletAdjust}
                            disabled={walletAdjustSubmitting}
                            className={`flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${walletAdjustMode === 'deduct' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-800 hover:bg-green-900'}`}
                          >
                            {walletAdjustSubmitting ? 'Saving...' : walletAdjustMode === 'deduct' ? 'Deduct' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )}
                    {detailData.lastTransaction && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Last transaction</p>
                        <p className="text-sm font-medium">{detailData.lastTransaction.description}</p>
                        <p className="text-sm text-gray-600">{detailData.lastTransaction.amountPaise >= 0 ? '+' : ''}₹{detailData.lastTransaction.amountRs} · {formatDateLocal(detailData.lastTransaction.createdAt, 'short')}</p>
                      </div>
                    )}
                  </Card>
                  {detailData.monthlyPayment && (
                    <Card className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-green-800" /> Monthly Payment
                      </h3>
                      <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div><dt className="text-gray-500">Month</dt><dd className="font-medium">{new Date(detailData.monthlyPayment.year, detailData.monthlyPayment.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</dd></div>
                        <div><dt className="text-gray-500">Total cost</dt><dd className="font-medium">{'\u20B9'}{detailData.monthlyPayment.totalCostRs}</dd></div>
                        <div><dt className="text-gray-500">Amount paid</dt><dd className="font-medium">{'\u20B9'}{detailData.monthlyPayment.amountPaidRs}</dd></div>
                        <div><dt className="text-gray-500">Amount due</dt><dd className="font-medium">{'\u20B9'}{detailData.monthlyPayment.amountDueRs}</dd></div>
                        <div><dt className="text-gray-500">Status</dt><dd><Badge variant={detailData.monthlyPayment.status === 'PAID' ? 'success' : detailData.monthlyPayment.status === 'OVERDUE' ? 'default' : 'warning'}>{detailData.monthlyPayment.status}</Badge></dd></div>
                        {detailData.monthlyPayment.paidAt && (
                          <div><dt className="text-gray-500">Paid at</dt><dd className="font-medium">{formatDateLocal(detailData.monthlyPayment.paidAt, 'short')}</dd></div>
                        )}
                      </dl>
                    </Card>
                  )}
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-green-800" /> Subscription
                    </h3>
                    {detailData.subscription ? (
                      <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div><dt className="text-gray-500">Daily quantity</dt><dd className="font-medium">{detailData.subscription.dailyQuantityMl >= 1000 ? `${detailData.subscription.dailyQuantityMl / 1000}L` : `${detailData.subscription.dailyQuantityMl}ml`}</dd></div>
                        <div><dt className="text-gray-500">Status</dt><dd><Badge variant={detailData.subscription.status === 'ACTIVE' ? 'success' : detailData.subscription.status === 'PAUSED' ? 'warning' : 'default'}>{detailData.subscription.status}</Badge></dd></div>
                        <div><dt className="text-gray-500">Empty bottles with customer</dt><dd className="font-medium">{detailData.bottleBalance.large} × 1L, {detailData.bottleBalance.small} × 500ml</dd></div>
                        <div className="pt-2 border-t border-gray-100 mt-1">
                          <dt className="text-gray-500 mb-1">Delivery count</dt>
                          <dd className="flex items-center gap-2">
                            <span className="font-medium text-lg">{detailData.subscription.deliveryCount}</span>
                            <span className="text-xs text-gray-400">
                              (next deposit in {Math.max(0, 120 - (detailData.subscription.deliveryCount - detailData.subscription.lastDepositAtDelivery))} deliveries)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditDeliveryCount(String(detailData.subscription!.deliveryCount));
                                setDeliveryCountEditOpen(!deliveryCountEditOpen);
                              }}
                              className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <PenLine className="w-3.5 h-3.5" /> Edit
                            </button>
                          </dd>
                          {deliveryCountEditOpen && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={editDeliveryCount}
                                onChange={(e) => setEditDeliveryCount(e.target.value)}
                                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleDeliveryCountUpdate}
                                disabled={deliveryCountUpdating}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-800 hover:bg-green-900 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deliveryCountUpdating ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveryCountEditOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
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
                            const prevMonth = calMonth - 1;
                            if (prevMonth < 0) { setCalYear(calYear - 1); setCalMonth(11); }
                            else { setCalMonth(prevMonth); }
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Previous month"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                          {new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const nextMonth = calMonth + 1;
                            if (nextMonth > 11) { setCalYear(calYear + 1); setCalMonth(0); }
                            else { setCalMonth(nextMonth); }
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
                          const isClickable = !!status;

                          if (status === 'DELIVERED') bg = 'bg-green-200 text-green-900';
                          else if (status === 'PAUSED') bg = 'bg-orange-200 text-orange-800';
                          else if (status === 'NOT_DELIVERED') bg = 'bg-red-200 text-red-800';
                          else if (status === 'SCHEDULED') bg = 'bg-yellow-100 text-yellow-800';
                          else if (mod) bg = 'bg-blue-200 text-blue-800';

                          if (mod) title += ` (Modified: ${mod.quantityMl}ml)`;
                          if (isClickable) title += ' (Click to view/edit)';

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
                    deliveryDetails.status === 'SCHEDULED' ? 'warning' :
                    deliveryDetails.status === 'PAUSED' ? 'warning' :
                    deliveryDetails.status === 'NOT_DELIVERED' ? 'error' :
                    'default'
                  }>
                    {deliveryDetails.status === 'SCHEDULED' ? 'Scheduled' :
                     deliveryDetails.status === 'DELIVERED' ? 'Delivered' :
                     deliveryDetails.status === 'NOT_DELIVERED' ? 'Not Delivered' :
                     deliveryDetails.status}
                  </Badge>
                </div>

                {/* Bottle collection inputs (for SCHEDULED and DELIVERED) */}
                {(deliveryDetails.status === 'SCHEDULED' || deliveryDetails.status === 'DELIVERED') && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-700 font-medium mb-3">Bottles Collected</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-orange-600 mb-1">1L Bottles</label>
                        <input
                          type="number"
                          min={0}
                          value={editLargeCollected}
                          onChange={(e) => setEditLargeCollected(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-orange-600 mb-1">500ml Bottles</label>
                        <input
                          type="number"
                          min={0}
                          value={editSmallCollected}
                          onChange={(e) => setEditSmallCollected(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {deliveryDetails.status === 'DELIVERED' && (
                  <>
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

                {/* Action buttons based on status */}
                {deliveryDetails.status === 'SCHEDULED' && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-gray-500">Mark this delivery:</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeliveryUpdate('DELIVERED')}
                        disabled={deliveryUpdating}
                        className="flex-1 px-3 py-2.5 text-sm font-medium text-white bg-green-800 hover:bg-green-900 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deliveryUpdating ? 'Updating...' : 'Mark Delivered'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeliveryUpdate('NOT_DELIVERED')}
                        disabled={deliveryUpdating}
                        className="flex-1 px-3 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deliveryUpdating ? 'Updating...' : 'Not Delivered'}
                      </button>
                    </div>
                  </div>
                )}

                {deliveryDetails.status === 'DELIVERED' && (
                  <button
                    type="button"
                    onClick={() => handleDeliveryUpdate()}
                    disabled={deliveryUpdating || (editLargeCollected === deliveryDetails.largeBottlesCollected && editSmallCollected === deliveryDetails.smallBottlesCollected)}
                    className="w-full px-3 py-2.5 text-sm font-medium text-white bg-green-800 hover:bg-green-900 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deliveryUpdating ? 'Saving...' : 'Update Bottle Collection'}
                  </button>
                )}
              </div>
            )}

            {!deliveryDetailsLoading && !deliveryDetails && (
              <div className="py-8 text-center">
                <p className="text-gray-500">Could not load delivery details for this date.</p>
              </div>
            )}

            <div className="mt-4">
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

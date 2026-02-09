import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { getApiUrl } from '../../config/api';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Filter } from 'lucide-react';

type DeliveryRow = {
  id: string;
  date: string;
  customerName: string;
  customerPhone: string;
  quantityMl: number;
  liters: number;
  largeBottles: number;
  smallBottles: number;
  deliveryPersonName: string;
  status: string;
  largeBottlesCollected: number;
  smallBottlesCollected: number;
  deliveredAt: string | null;
};

type DeliveryPerson = { id: string; name: string };

type ApiResponse = {
  deliveries: DeliveryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalLiters: number;
  total1LBottles: number;
  total500mlBottles: number;
  deliveryPersons: DeliveryPerson[];
};

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  DELIVERED: { label: 'Delivered', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'warning' },
  NOT_DELIVERED: { label: 'Not Delivered', variant: 'error' },
  PAUSED: { label: 'Paused', variant: 'default' },
  BLOCKED: { label: 'Blocked', variant: 'error' },
  HOLIDAY: { label: 'Holiday', variant: 'default' },
};

export const AdminDeliveries: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [date, setDate] = useState(toDateString(new Date()));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [deliveryPersonId, setDeliveryPersonId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');

    if (useRange) {
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
    } else {
      params.set('date', date);
    }

    if (deliveryPersonId) params.set('deliveryPersonId', deliveryPersonId);
    if (status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);

    fetch(getApiUrl(`/api/admin/deliveries-history?${params.toString()}`), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load deliveries'))
      .finally(() => setLoading(false));
  }, [page, date, dateFrom, dateTo, useRange, deliveryPersonId, status, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setPage(1);
  };

  const goToday = () => {
    setUseRange(false);
    setDate(toDateString(new Date()));
    setPage(1);
  };

  // Summary stats
  const deliveredCount = data?.deliveries.filter(d => d.status === 'DELIVERED').length ?? 0;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Deliveries</h1>
            <p className="text-sm text-gray-600">
              {data ? `${data.total} total records` : 'All delivery records'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors"
            >
              Today
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={useRange}
                onChange={(e) => { setUseRange(e.target.checked); setPage(1); }}
                className="rounded"
              />
              Date Range
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {!useRange ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Person</label>
              <select
                value={deliveryPersonId}
                onChange={(e) => { setDeliveryPersonId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
              >
                <option value="">All</option>
                {data?.deliveryPersons.map(dp => (
                  <option key={dp.id} value={dp.id}>{dp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="NOT_DELIVERED">Not Delivered</option>
                <option value="PAUSED">Paused</option>
                <option value="BLOCKED">Blocked</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
            </div>

            {!useRange && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Search Customer</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Customer name..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Search className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Summary bar */}
        {data && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Total Records</p>
              <p className="text-xl font-bold text-gray-900">{data.total}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Liters to Load</p>
              <p className="text-xl font-bold text-blue-700">{data.totalLiters}L</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">1L Bottles</p>
              <p className="text-xl font-bold text-green-800">{data.total1LBottles}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">500ml Bottles</p>
              <p className="text-xl font-bold text-purple-700">{data.total500mlBottles}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Page</p>
              <p className="text-xl font-bold text-gray-900">{data.page} / {data.totalPages}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bottles</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Delivered By</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Collected</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data && data.deliveries.length > 0 ? (
                  data.deliveries.map((d) => {
                    const sc = statusConfig[d.status] || { label: d.status, variant: 'default' as const };
                    return (
                      <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">{formatDate(d.date)}</td>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900">{d.customerName}</p>
                          <p className="text-xs text-gray-500">{d.customerPhone}</p>
                        </td>
                        <td className="py-3 px-4 text-center text-sm font-semibold text-gray-900">
                          {d.liters >= 1 ? `${d.liters}L` : `${d.quantityMl}ml`}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-700">
                          {d.largeBottles > 0 && <span>{d.largeBottles}×1L</span>}
                          {d.largeBottles > 0 && d.smallBottles > 0 && ', '}
                          {d.smallBottles > 0 && <span>{d.smallBottles}×500ml</span>}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">{d.deliveryPersonName}</td>
                        <td className="py-3 px-4 text-center text-sm text-gray-700">
                          {d.status === 'DELIVERED' ? (
                            <>
                              {d.largeBottlesCollected > 0 && <span>{d.largeBottlesCollected}×1L</span>}
                              {d.largeBottlesCollected > 0 && d.smallBottlesCollected > 0 && ', '}
                              {d.smallBottlesCollected > 0 && <span>{d.smallBottlesCollected}×500ml</span>}
                              {d.largeBottlesCollected === 0 && d.smallBottlesCollected === 0 && '—'}
                            </>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-gray-500">
                          {formatTime(d.deliveredAt)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No deliveries found for the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {((data.page - 1) * data.limit) + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (data.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= data.totalPages - 2) {
                    pageNum = data.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-green-800 text-white'
                          : 'hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                  disabled={page >= data.totalPages}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

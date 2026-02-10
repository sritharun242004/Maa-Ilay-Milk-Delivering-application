import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { getApiUrl } from '../../config/api';
import { Search, ChevronLeft, ChevronRight, RefreshCw, IndianRupee, Download } from 'lucide-react';

type PaymentRow = {
  id: string;
  date: string;
  customerName: string;
  customerPhone: string;
  amountPaise: number;
  amountRs: string;
  description: string;
  referenceId: string | null;
};

type ApiResponse = {
  payments: PaymentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmountRs: string;
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const AdminPayments: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');

    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);

    fetch(getApiUrl(`/api/admin/payments?${params.toString()}`), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load payments'))
      .finally(() => setLoading(false));
  }, [page, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Payments</h1>
            <p className="text-sm text-gray-600">
              {data ? `${data.total} total payments` : 'Customer wallet top-up records'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setExporting(true);
                const params = new URLSearchParams();
                if (dateFrom) params.set('dateFrom', dateFrom);
                if (dateTo) params.set('dateTo', dateTo);
                if (search) params.set('search', search);
                fetch(getApiUrl(`/api/admin/payments-export?${params.toString()}`), { credentials: 'include' })
                  .then((res) => {
                    if (!res.ok) throw new Error('Export failed');
                    return res.blob();
                  })
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'payments.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch(() => alert('Failed to export payments'))
                  .finally(() => setExporting(false));
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors"
            >
              All Payments
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-800 focus:ring-1 focus:ring-green-800/20 outline-none"
              />
            </div>
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
          </div>
        </Card>

        {/* Summary */}
        {data && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Total Payments</p>
              <p className="text-xl font-bold text-gray-900">{data.total}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="text-xl font-bold text-green-800 flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />
                {Number(data.totalAmountRs).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Page</p>
              <p className="text-xl font-bold text-gray-900">{data.page} / {data.totalPages || 1}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data && data.payments.length > 0 ? (
                  data.payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{formatDate(p.date)}</p>
                        <p className="text-xs text-gray-500">{formatTime(p.date)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-900">{p.customerName}</p>
                        <p className="text-xs text-gray-500">{p.customerPhone}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-green-700">
                          +{Number(p.amountRs).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-gray-500">
                      No payments found
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

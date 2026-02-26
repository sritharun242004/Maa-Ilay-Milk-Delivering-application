import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchWithCsrf } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

type InventoryLog = {
  id: string;
  action: string;
  largeBottlesDelta: number;
  smallBottlesDelta: number;
  reason: string;
  performedByAdminId: string;
  adminName: string;
  createdAt: string;
};

type InventoryData = {
  totalBottles: number;
  largeTotal: number;
  smallTotal: number;
  withCustomers: number;
  largeInCirculation: number;
  smallInCirculation: number;
  inWarehouse: number;
  largeInWarehouse: number;
  smallInWarehouse: number;
  recentLogs: InventoryLog[];
};

// --- Modals ---

function AddBatchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [large, setLarge] = useState('');
  const [small, setSmall] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseInt(large) || 0;
    const s = parseInt(small) || 0;
    if (l === 0 && s === 0) { setError('Enter at least one quantity'); return; }
    if (l < 0 || s < 0) { setError('Quantities must be non-negative'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetchWithCsrf('/api/admin/inventory/add-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ largeBottles: l, smallBottles: s, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add batch');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-white p-6 w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Add Bottle Batch</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">1L Bottles</label>
            <input type="number" min="0" value={large} onChange={e => setLarge(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">500ml Bottles</label>
            <input type="number" min="0" value={small} onChange={e => setSmall(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. Supplier delivery" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting} className="flex-1">Add Batch</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ReduceStockModal({
  onClose, onSuccess, actionType, maxLarge, maxSmall,
}: {
  onClose: () => void;
  onSuccess: () => void;
  actionType: 'BATCH_DISCARDED' | 'BROKEN_REPORTED';
  maxLarge: number;
  maxSmall: number;
}) {
  const isDiscard = actionType === 'BATCH_DISCARDED';
  const [large, setLarge] = useState('');
  const [small, setSmall] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseInt(large) || 0;
    const s = parseInt(small) || 0;
    if (l === 0 && s === 0) { setError('Enter at least one quantity'); return; }
    if (l < 0 || s < 0) { setError('Quantities must be non-negative'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }
    if (l > maxLarge) { setError(`1L bottles cannot exceed warehouse stock (${maxLarge})`); return; }
    if (s > maxSmall) { setError(`500ml bottles cannot exceed warehouse stock (${maxSmall})`); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetchWithCsrf('/api/admin/inventory/reduce-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ largeBottles: l, smallBottles: s, reason: reason.trim(), action: actionType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update stock');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-white p-6 w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{isDiscard ? 'Discard Bottles' : 'Report Broken Bottles'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-3">Warehouse stock: 1L: {maxLarge} | 500ml: {maxSmall}</p>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">1L Bottles</label>
            <input type="number" min="0" max={maxLarge} value={large} onChange={e => setLarge(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">500ml Bottles</label>
            <input type="number" min="0" max={maxSmall} value={small} onChange={e => setSmall(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder={isDiscard ? 'e.g. Old batch expired' : 'e.g. Handling damage'} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="danger" loading={submitting} className="flex-1">
              {isDiscard ? 'Discard' : 'Report Broken'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function LogsModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(getApiUrl(`/api/admin/inventory/logs?${params}`), { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterChange = (val: string) => {
    setActionFilter(val);
    setPage(1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-white p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Inventory Logs</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="mb-3">
          <select value={actionFilter} onChange={e => handleFilterChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Actions</option>
            <option value="BATCH_ADDED">Added</option>
            <option value="BATCH_DISCARDED">Discarded</option>
            <option value="BROKEN_REPORTED">Broken</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No logs found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">1L</th>
                  <th className="pb-2 font-medium">500ml</th>
                  <th className="pb-2 font-medium">Notes</th>
                  <th className="pb-2 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-2"><ActionBadge action={log.action} /></td>
                    <td className="py-2"><DeltaDisplay value={log.largeBottlesDelta} /></td>
                    <td className="py-2"><DeltaDisplay value={log.smallBottlesDelta} /></td>
                    <td className="py-2 max-w-[150px] truncate" title={log.reason}>{log.reason}</td>
                    <td className="py-2">{log.adminName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              icon={ChevronLeft} iconPosition="left">Prev</Button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              icon={ChevronRight}>Next</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Helpers ---

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case 'BATCH_ADDED':
      return <Badge variant="success">Added</Badge>;
    case 'BATCH_DISCARDED':
      return <Badge variant="warning">Discarded</Badge>;
    case 'BROKEN_REPORTED':
      return <Badge variant="error">Broken</Badge>;
    default:
      return <Badge>{action}</Badge>;
  }
}

function DeltaDisplay({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-400">0</span>;
  if (value > 0) return <span className="text-green-600">+{value}</span>;
  return <span className="text-red-600">{value}</span>;
}

// --- Main Page ---

export default function Inventory() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [reduceAction, setReduceAction] = useState<'BATCH_DISCARDED' | 'BROKEN_REPORTED' | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(getApiUrl('/api/admin/inventory'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load inventory');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load inventory'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleMutationSuccess = (msg: string) => {
    showSuccess(msg);
    setShowAddBatch(false);
    setReduceAction(null);
    fetchData();
  };

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto py-12 text-center text-red-600">{error}</div>
      </AdminLayout>
    );
  }

  const d = data!;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
            <p className="text-gray-500 text-sm mt-1">Manage bottle stock</p>
          </div>
          <div className="flex gap-2 mt-3 sm:mt-0">
            <Button variant="primary" size="sm" icon={Plus} iconPosition="left" onClick={() => setShowAddBatch(true)}>
              Add Batch
            </Button>
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowReportMenu(v => !v)}>
                Report
              </Button>
              {showReportMenu && (
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => { setReduceAction('BATCH_DISCARDED'); setShowReportMenu(false); }}>
                    <Trash2 className="w-4 h-4 text-yellow-600" /> Discard Bottles
                  </button>
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => { setReduceAction('BROKEN_REPORTED'); setShowReportMenu(false); }}>
                    <AlertTriangle className="w-4 h-4 text-red-600" /> Report Broken
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm mb-4">
            {successMsg}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 bg-white">
            <p className="text-sm text-gray-500 mb-1">Total Bottles</p>
            <p className="text-3xl font-bold text-gray-900">{d.totalBottles}</p>
            <p className="text-sm text-gray-400 mt-1">1L: {d.largeTotal} | 500ml: {d.smallTotal}</p>
          </Card>
          <Card className="p-5 bg-white">
            <p className="text-sm text-gray-500 mb-1">With Customers</p>
            <p className="text-3xl font-bold text-gray-900">{d.withCustomers}</p>
            <p className="text-sm text-gray-400 mt-1">1L: {d.largeInCirculation} | 500ml: {d.smallInCirculation}</p>
          </Card>
          <Card className="p-5 bg-white">
            <p className="text-sm text-gray-500 mb-1">In Warehouse</p>
            <p className="text-3xl font-bold text-gray-900">{d.inWarehouse}</p>
            <p className="text-sm text-gray-400 mt-1">1L: {d.largeInWarehouse} | 500ml: {d.smallInWarehouse}</p>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Button variant="secondary" size="sm" onClick={() => setShowLogs(true)}>View All Logs</Button>
          </div>
          {d.recentLogs.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No inventory activity yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">1L</th>
                    <th className="pb-2 font-medium">500ml</th>
                    <th className="pb-2 font-medium">Notes</th>
                    <th className="pb-2 font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentLogs.map(log => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2.5 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="py-2.5"><ActionBadge action={log.action} /></td>
                      <td className="py-2.5"><DeltaDisplay value={log.largeBottlesDelta} /></td>
                      <td className="py-2.5"><DeltaDisplay value={log.smallBottlesDelta} /></td>
                      <td className="py-2.5 max-w-[200px] truncate" title={log.reason}>{log.reason}</td>
                      <td className="py-2.5">{log.adminName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      {showAddBatch && (
        <AddBatchModal onClose={() => setShowAddBatch(false)} onSuccess={() => handleMutationSuccess('Batch added successfully')} />
      )}
      {reduceAction && (
        <ReduceStockModal
          actionType={reduceAction}
          maxLarge={d.largeInWarehouse}
          maxSmall={d.smallInWarehouse}
          onClose={() => setReduceAction(null)}
          onSuccess={() => handleMutationSuccess(
            reduceAction === 'BATCH_DISCARDED' ? 'Bottles discarded successfully' : 'Broken bottles reported'
          )}
        />
      )}
      {showLogs && <LogsModal onClose={() => setShowLogs(false)} />}
    </AdminLayout>
  );
}

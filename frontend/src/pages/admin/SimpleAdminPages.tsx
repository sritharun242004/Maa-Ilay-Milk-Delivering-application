import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Plus, Pencil, KeyRound } from 'lucide-react';
import { useDeliveryTeam } from '../../hooks/useCachedData';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';

type StaffRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  mustChangePassword?: boolean;
  todayDeliveries: number; // FIX: Add completed deliveries count
  todayLoad: number;
  maxLoad: number;
  customerCount: number; // Total customers assigned
};

type DeliveryTeamData = {
  totalStaff: number;
  activeToday: number;
  staff: StaffRow[];
};


export const DeliveryTeam: React.FC = () => {
  // Use cached data hook with 1-hour TTL
  const { data, loading, error, refetch: fetchTeam } = useDeliveryTeam();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openEdit = (staff: StaffRow) => {
    setSelectedStaff(staff);
    setActionError(null);
    setEditOpen(true);
  };
  const openReset = (staff: StaffRow) => {
    setSelectedStaff(staff);
    setActionError(null);
    setResetOpen(true);
  };

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Delivery Team</h1>
            <p className="text-gray-600">Staff and today&apos;s load. Add members and manage passwords.</p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            iconPosition="left"
            onClick={() => {
              setActionError(null);
              setAddOpen(true);
            }}
          >
            Add delivery person
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Delivery Staff</p>
            <p className="text-4xl font-bold text-gray-900">{d.totalStaff}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Active Today</p>
            <p className="text-4xl font-bold text-emerald-600">{d.activeToday}</p>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Phone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Today&apos;s Progress</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {d.staff.map((staff) => (
                  <tr key={staff.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium">{staff.name}</td>
                    <td className="py-4 px-4">{staff.phone}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={staff.status === 'active' ? 'success' : 'warning'}>
                          {staff.status}
                        </Badge>
                        {staff.mustChangePassword && (
                          <Badge variant="info">Must change password</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-emerald-600">
                          {staff.todayDeliveries || 0} completed
                        </span>
                        <span className="text-sm text-gray-500">
                          {staff.todayLoad || 0} assigned
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(staff)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-emerald-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openReset(staff)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-orange-600"
                          title="Reset password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {addOpen && (
        <AddDeliveryModal
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            fetchTeam();
          }}
          onError={setActionError}
        />
      )}
      {editOpen && selectedStaff && (
        <EditDeliveryModal
          staff={selectedStaff}
          onClose={() => {
            setEditOpen(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            setEditOpen(false);
            setSelectedStaff(null);
            fetchTeam();
          }}
          onError={setActionError}
        />
      )}
      {resetOpen && selectedStaff && (
        <ResetPasswordModal
          staff={selectedStaff}
          onClose={() => {
            setResetOpen(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => { }}
          onDone={() => {
            setResetOpen(false);
            setSelectedStaff(null);
            fetchTeam();
          }}
          onError={setActionError}
        />
      )}
      {actionError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow">
          {actionError}
        </div>
      )}
    </AdminLayout>
  );
};

function AddDeliveryModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (password !== confirm) {
      onError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      onError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    fetchWithCsrf('/api/admin/delivery-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        password,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          onSuccess();
        } else {
          if (data?.error?.includes('CSRF')) {
            clearCsrfToken();
            onError('Invalid CSRF token. Please refresh the page and try again.');
          } else {
            onError(data?.error || 'Failed to add delivery person');
          }
        }
      })
      .catch(() => onError('Request failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add delivery person</h2>
        <p className="text-sm text-gray-600 mb-4">Set an initial one-time password. They must change it on first login.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (10 digits)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              maxLength={10}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial password (min 6 chars)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
              placeholder="One-time password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {submitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditDeliveryModal({
  staff,
  onClose,
  onSuccess,
  onError,
}: {
  staff: StaffRow;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone);
  const [isActive, setIsActive] = useState(staff.status === 'active');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setSubmitting(true);
    fetch(`/api/admin/delivery-team/${staff.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        isActive,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          onSuccess();
        } else {
          onError(data?.error || 'Failed to update');
        }
      })
      .catch(() => onError('Request failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Edit delivery person</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (10 digits)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              maxLength={10}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="edit-active" className="text-sm font-medium text-gray-700">Active</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ResetPasswordModal({
  staff,
  onClose,
  onSuccess,
  onDone,
  onError,
}: {
  staff: StaffRow;
  onClose: () => void;
  onSuccess: (oneTimePassword: string) => void;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oneTime, setOneTime] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (newPassword !== confirm) {
      onError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      onError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    fetchWithCsrf(`/api/admin/delivery-team/${staff.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.oneTimePassword) {
          setOneTime(data.oneTimePassword);
          onSuccess(data.oneTimePassword);
        } else if (ok) {
          onDone();
        } else {
          if (data?.error?.includes('CSRF')) {
            clearCsrfToken();
            onError('Invalid CSRF token. Please refresh the page and try again.');
          } else {
            onError(data?.error || 'Failed to reset password');
          }
        }
      })
      .catch(() => onError('Request failed'))
      .finally(() => setSubmitting(false));
  };

  if (oneTime) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">One-time password set</h2>
          <p className="text-sm text-gray-600 mb-4">
            Share this password with <strong>{staff.name}</strong> (phone: {staff.phone}). They must use it to log in once, then change it.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg font-mono text-lg mb-4 break-all">{oneTime}</div>
          <Button variant="primary" fullWidth onClick={() => navigator.clipboard.writeText(oneTime)}>
            Copy to clipboard
          </Button>
          <Button variant="secondary" fullWidth className="mt-2" onClick={onDone}>
            Done
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Reset password for {staff.name}</h2>
        <p className="text-sm text-gray-600 mb-4">Set a new one-time password. They must change it on next login.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password (min 6 chars)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
              {submitting ? 'Setting...' : 'Set password'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

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
};

export const Inventory: React.FC = () => {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/inventory', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load inventory');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load inventory'))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Inventory</h1>
        <p className="text-gray-600 mb-8">Bottle stock (data from database)</p>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <p className="text-sm opacity-90 mb-2">Total Bottles</p>
            <p className="text-4xl font-bold mb-2">{d.totalBottles}</p>
            <p className="text-sm opacity-80">1L: {d.largeTotal} | 500ml: {d.smallTotal}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <p className="text-sm opacity-90 mb-2">With Customers</p>
            <p className="text-4xl font-bold mb-2">{d.withCustomers}</p>
            <p className="text-sm opacity-80">1L: {d.largeInCirculation} | 500ml: {d.smallInCirculation}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <p className="text-sm opacity-90 mb-2">In Warehouse</p>
            <p className="text-4xl font-bold mb-2">{d.inWarehouse}</p>
            <p className="text-sm opacity-80">1L: {d.largeInWarehouse} | 500ml: {d.smallInWarehouse}</p>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

type FlaggedCustomer = {
  id: string;
  name: string;
  phone: string;
  deliveryPersonName: string;
  largeBottles: number;
  smallBottles: number;
  totalBottles: number;
  oldestBottleDate: string;
  daysOverdue: number;
};

type PenaltiesData = {
  totalPendingRs: number;
  collectedThisMonthRs: number;
  flaggedCustomersCount: number;
  flaggedCustomers: FlaggedCustomer[];
  rules: string[];
};

export const Penalties: React.FC = () => {
  const [data, setData] = useState<PenaltiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<FlaggedCustomer | null>(null);
  const [imposing, setImposing] = useState(false);
  const [imposeResult, setImposeResult] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/penalties', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load penalties');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load penalties'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Penalties</h1>
        <p className="text-gray-600 mb-8">Real-time penalty tracking (bottles not returned after 3 days)</p>

        {imposeResult && (
          <div className={`mb-6 p-4 rounded-lg ${imposeResult.startsWith('✓') ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {imposeResult}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Pending</p>
            <p className="text-4xl font-bold text-orange-600">₹{d.totalPendingRs.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-2">Penalties yet to be charged</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Collected This Month</p>
            <p className="text-4xl font-bold text-emerald-600">₹{d.collectedThisMonthRs.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-2">Total penalties charged</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Flagged Customers</p>
            <p className="text-4xl font-bold text-red-600">{d.flaggedCustomersCount}</p>
            <p className="text-xs text-gray-500 mt-2">Customers with overdue bottles</p>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Penalty Rules</h2>
          <ul className="space-y-2 text-gray-700">
            {d.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Review flagged customers below and manually impose fines as needed. Admin can adjust penalty amounts before imposing.
            </p>
          </div>
        </Card>

        {d.flaggedCustomers && d.flaggedCustomers.length > 0 && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Flagged Customers</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Name</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Bottles</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Delivered By</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Days Overdue</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {d.flaggedCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-200 hover:bg-red-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.phone}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col gap-1">
                          {customer.largeBottles > 0 && (
                            <span className="text-sm font-medium text-blue-700">
                              {customer.largeBottles} × 1L
                            </span>
                          )}
                          {customer.smallBottles > 0 && (
                            <span className="text-sm font-medium text-purple-700">
                              {customer.smallBottles} × 500ml
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700 font-medium">
                        {customer.deliveryPersonName}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 font-bold rounded-full">
                          {customer.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Button
                          onClick={() => setSelectedCustomer(customer)}
                          variant="primary"
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Impose Fine
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Impose Fine Modal */}
      {selectedCustomer && (
        <ImposeFineModal
          customer={selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            setImposeResult(null);
          }}
          onSuccess={(message) => {
            setImposeResult(`✓ ${message}`);
            setSelectedCustomer(null);
            setTimeout(() => fetchData(), 500);
          }}
          onError={(message) => {
            setImposeResult(`✗ ${message}`);
          }}
          imposing={imposing}
          setImposing={setImposing}
        />
      )}
    </AdminLayout>
  );
};

function ImposeFineModal({
  customer,
  onClose,
  onSuccess,
  onError,
  imposing,
  setImposing,
}: {
  customer: FlaggedCustomer;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  imposing: boolean;
  setImposing: (val: boolean) => void;
}) {
  const [largeBottlePrice, setLargeBottlePrice] = useState('35');
  const [smallBottlePrice, setSmallBottlePrice] = useState('25');

  const totalAmount = (customer.largeBottles * parseFloat(largeBottlePrice || '0')) + (customer.smallBottles * parseFloat(smallBottlePrice || '0'));

  const handleImpose = async () => {
    onError('');
    const largePriceNum = parseFloat(largeBottlePrice);
    const smallPriceNum = parseFloat(smallBottlePrice);

    if (isNaN(largePriceNum) || largePriceNum < 0) {
      onError('Invalid price for 1L bottles');
      return;
    }
    if (isNaN(smallPriceNum) || smallPriceNum < 0) {
      onError('Invalid price for 500ml bottles');
      return;
    }

    setImposing(true);
    try {
      const response = await fetchWithCsrf('/api/admin/penalties/impose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          largeBottlePriceRs: largePriceNum,
          smallBottlePriceRs: smallPriceNum,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to impose penalty');
      }

      const result = await response.json();
      onSuccess(result.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to impose penalty');
    } finally {
      setImposing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Impose Fine</h2>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Customer</p>
          <p className="font-semibold text-gray-900">{customer.name}</p>
          <p className="text-sm text-gray-500">{customer.phone}</p>
          <p className="text-xs text-gray-500 mt-2">
            Delivered by: <span className="font-medium">{customer.deliveryPersonName}</span>
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {customer.largeBottles > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">1L Bottles</p>
                <p className="text-2xl font-bold text-blue-700">{customer.largeBottles}</p>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per bottle (₹)</label>
                <input
                  type="number"
                  value={largeBottlePrice}
                  onChange={(e) => setLargeBottlePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 outline-none"
                />
              </div>
            </div>
          )}

          {customer.smallBottles > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">500ml Bottles</p>
                <p className="text-2xl font-bold text-purple-700">{customer.smallBottles}</p>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per bottle (₹)</label>
                <input
                  type="number"
                  value={smallBottlePrice}
                  onChange={(e) => setSmallBottlePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-700 font-medium mb-1">Total Penalty Amount</p>
          <p className="text-3xl font-bold text-orange-900">₹{totalAmount.toFixed(2)}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={imposing}>
            Cancel
          </Button>
          <Button onClick={handleImpose} className="flex-1 bg-orange-600 hover:bg-orange-700" disabled={imposing}>
            {imposing ? 'Imposing...' : 'Impose Fine'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const Reports: React.FC = () => {
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Reports</h1>
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { title: 'Daily Delivery Report', desc: 'All deliveries, status, revenue', color: 'emerald' },
            { title: 'Customer Report', desc: 'Active customers, plans, payments', color: 'blue' },
            { title: 'Revenue Report', desc: 'Daily/Monthly revenue breakdown', color: 'green' },
            { title: 'Bottle Inventory Report', desc: 'Issued, collected, balance', color: 'orange' },
          ].map((report) => (
            <Card key={report.title} className="p-8">
              <div className={`w-16 h-16 bg-${report.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                <div className={`w-8 h-8 bg-${report.color}-500 rounded-lg`}></div>
              </div>
              <h3 className="text-2xl font-bold mb-2">{report.title}</h3>
              <p className="text-gray-600 mb-6">{report.desc}</p>
              <button className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600">
                Export Report
              </button>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export const Settings: React.FC = () => {
  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Settings</h1>
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Milk Pricing</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">1L Milk Price (per day)</label>
              <input type="number" value="110" className="w-full px-4 py-3 border-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">500ml Milk Price (per day)</label>
              <input type="number" value="55" className="w-full px-4 py-3 border-2 rounded-lg" />
            </div>
          </div>
        </Card>
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Operational Rules</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Delivery Time</label>
              <input type="time" value="06:00" className="w-full px-4 py-3 border-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cutoff Time</label>
              <input type="time" value="17:00" className="w-full px-4 py-3 border-2 rounded-lg" />
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

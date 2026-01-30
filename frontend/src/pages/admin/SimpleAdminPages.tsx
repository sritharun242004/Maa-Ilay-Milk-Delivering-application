import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Plus, MoreVertical, Pencil, KeyRound } from 'lucide-react';

type StaffRow = {
  id: string;
  name: string;
  phone: string;
  zone: string;
  status: string;
  mustChangePassword?: boolean;
  todayLoad: number;
  maxLoad: number;
};

type DeliveryTeamData = {
  totalStaff: number;
  activeToday: number;
  onLeave: number;
  staff: StaffRow[];
};

const ZONE_OPTIONS = ['Pondicherry Central', 'Auroville', 'White Town', 'Beach Road'];

export const DeliveryTeam: React.FC = () => {
  const [data, setData] = useState<DeliveryTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);

  const fetchTeam = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/delivery-team', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load delivery team');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load delivery team'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const openEdit = (staff: StaffRow) => {
    setSelectedStaff(staff);
    setActionError(null);
    setEditOpen(true);
  };
  const openReset = (staff: StaffRow) => {
    setSelectedStaff(staff);
    setActionError(null);
    setOneTimePassword(null);
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
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Delivery Staff</p>
            <p className="text-4xl font-bold text-gray-900">{d.totalStaff}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Active Today</p>
            <p className="text-4xl font-bold text-emerald-600">{d.activeToday}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">On Leave</p>
            <p className="text-4xl font-bold text-orange-600">{d.onLeave}</p>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Phone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold">Today&apos;s Load</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {d.staff.map((staff) => (
                  <tr key={staff.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium">{staff.name}</td>
                    <td className="py-4 px-4">{staff.phone}</td>
                    <td className="py-4 px-4">{staff.zone}</td>
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
                      {staff.todayLoad}/{staff.maxLoad}
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
          zoneOptions={ZONE_OPTIONS}
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
          zoneOptions={ZONE_OPTIONS}
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
            setOneTimePassword(null);
          }}
          onSuccess={(oneTime) => {
            setOneTimePassword(oneTime);
          }}
          onDone={() => {
            setResetOpen(false);
            setSelectedStaff(null);
            setOneTimePassword(null);
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
  zoneOptions,
  onClose,
  onSuccess,
  onError,
}: {
  zoneOptions: string[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('');
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
    fetch('/api/admin/delivery-team', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        zone: zone.trim() || undefined,
        password,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          onSuccess();
        } else {
          onError(data?.error || 'Failed to add delivery person');
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            >
              <option value="">— Select zone —</option>
              {zoneOptions.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
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
  zoneOptions,
  onClose,
  onSuccess,
  onError,
}: {
  staff: StaffRow;
  zoneOptions: string[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone);
  const [zone, setZone] = useState(staff.zone === '—' ? '' : staff.zone);
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
        zone: zone.trim() || null,
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 outline-none"
            >
              <option value="">— Select zone —</option>
              {zoneOptions.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
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
    fetch(`/api/admin/delivery-team/${staff.id}/reset-password`, {
      method: 'POST',
      credentials: 'include',
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
          onError(data?.error || 'Failed to reset password');
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

type ZoneData = { name: string; customers: number; staff: number; activeToday: number; areas: string[] };

export const Zones: React.FC = () => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/zones', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load zones');
        return res.json();
      })
      .then((data) => setZones(data.zones ?? []))
      .catch(() => setError('Could not load zones'))
      .finally(() => setLoading(false));
  }, []);

  if (loading && zones.length === 0) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }
  if (error && zones.length === 0) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto py-12 text-center text-red-600">{error}</div>
      </AdminLayout>
    );
  }
  const borders = ['border-emerald-500', 'border-purple-500', 'border-blue-500'];
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Zones</h1>
        <p className="text-gray-600 mb-8">Customers and staff by zone (data from database)</p>
        <div className="grid md:grid-cols-2 gap-8">
          {zones.map((zone, i) => (
            <Card key={zone.name} className={`p-8 border-4 ${borders[i % borders.length]}`}>
              <Badge variant={i === 0 ? 'success' : 'info'} className="mb-4">
                {i === 0 ? 'Primary Zone' : 'Zone'}
              </Badge>
              <h2 className="text-3xl font-bold mb-6">{zone.name}</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Customers</p>
                  <p className="text-2xl font-bold">{zone.customers}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Today</p>
                  <p className="text-2xl font-bold text-emerald-600">{zone.activeToday}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Staff</p>
                  <p className="text-2xl font-bold">{zone.staff}</p>
                </div>
              </div>
              {zone.areas && zone.areas.length > 0 && (
                <>
                  <p className="text-sm text-gray-600 mb-2">Coverage Areas:</p>
                  <div className="flex flex-wrap gap-2">
                    {zone.areas.map((area) => (
                      <Badge key={area}>{area}</Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
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

type PenaltiesData = {
  totalPendingRs: number;
  collectedThisMonthRs: number;
  flaggedCustomers: number;
  rules: string[];
};

export const Penalties: React.FC = () => {
  const [data, setData] = useState<PenaltiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/penalties', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load penalties');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load penalties'))
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Penalties</h1>
        <p className="text-gray-600 mb-8">Penalty summary (data from database)</p>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Pending</p>
            <p className="text-4xl font-bold text-orange-600">₹{d.totalPendingRs.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Collected This Month</p>
            <p className="text-4xl font-bold text-emerald-600">₹{d.collectedThisMonthRs.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-gray-600 mb-1">Flagged Customers</p>
            <p className="text-4xl font-bold text-red-600">{d.flaggedCustomers}</p>
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Penalty Rules</h2>
          <ul className="space-y-2 text-gray-700">
            {d.rules.map((rule, i) => (
              <li key={i}>• {rule}</li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminLayout>
  );
};

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

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Pencil, X, Check } from 'lucide-react';
import { fetchWithCsrf } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

interface ProductTier {
  id: string;
  quantityMl: number;
  label: string;
  dailyPricePaise: number;
  largeBottleDepositPaise: number;
  smallBottleDepositPaise: number;
  isActive: boolean;
  updatedAt: string;
}

export const Products: React.FC = () => {
  const [tiers, setTiers] = useState<ProductTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Milk price editing (per tier)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceRs, setEditPriceRs] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Bottle deposit editing (global — same for all tiers)
  const [editingDeposit, setEditingDeposit] = useState(false);
  const [editLargeDepositRs, setEditLargeDepositRs] = useState('');
  const [editSmallDepositRs, setEditSmallDepositRs] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    fetch(getApiUrl('/api/admin/products'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load products');
        return res.json();
      })
      .then(data => setTiers(data.tiers || []))
      .catch(() => setError('Failed to load product pricing'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // --- Milk price edit handlers ---
  const startPriceEdit = (tier: ProductTier) => {
    setEditingPriceId(tier.id);
    setEditPriceRs((tier.dailyPricePaise / 100).toString());
    setSuccessMsg(null);
    setError(null);
  };

  const cancelPriceEdit = () => {
    setEditingPriceId(null);
    setEditPriceRs('');
  };

  const savePriceEdit = async () => {
    if (!editingPriceId) return;
    const dailyPriceRs = parseFloat(editPriceRs);
    if (isNaN(dailyPriceRs) || dailyPriceRs <= 0) {
      setError('Daily price must be a positive number');
      return;
    }

    setSavingPrice(true);
    setError(null);
    try {
      const response = await fetchWithCsrf(`/api/admin/products/${editingPriceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyPricePaise: Math.round(dailyPriceRs * 100) }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update price');
      }
      showSuccess('Milk price updated successfully.');
      setEditingPriceId(null);
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
    } finally {
      setSavingPrice(false);
    }
  };

  // --- Bottle deposit edit handlers ---
  const startDepositEdit = () => {
    const first = tiers[0];
    if (!first) return;
    setEditingDeposit(true);
    setEditLargeDepositRs((first.largeBottleDepositPaise / 100).toString());
    setEditSmallDepositRs((first.smallBottleDepositPaise / 100).toString());
    setSuccessMsg(null);
    setError(null);
  };

  const cancelDepositEdit = () => {
    setEditingDeposit(false);
    setEditLargeDepositRs('');
    setEditSmallDepositRs('');
  };

  const saveDepositEdit = async () => {
    const largeRs = parseFloat(editLargeDepositRs);
    const smallRs = parseFloat(editSmallDepositRs);
    if (isNaN(largeRs) || largeRs < 0) {
      setError('1L bottle deposit must be >= 0');
      return;
    }
    if (isNaN(smallRs) || smallRs < 0) {
      setError('500ml bottle deposit must be >= 0');
      return;
    }

    setSavingDeposit(true);
    setError(null);
    try {
      // Update deposit on all tiers (they share the same deposit values)
      await Promise.all(
        tiers.map(tier =>
          fetchWithCsrf(`/api/admin/products/${tier.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              largeBottleDepositPaise: Math.round(largeRs * 100),
              smallBottleDepositPaise: Math.round(smallRs * 100),
            }),
          }).then(res => {
            if (!res.ok) throw new Error('Failed to update deposit');
          })
        )
      );
      showSuccess('Bottle deposit amounts updated successfully.');
      setEditingDeposit(false);
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deposits');
    } finally {
      setSavingDeposit(false);
    }
  };

  // Read deposit from first tier
  const largeDepositRs = tiers[0] ? (tiers[0].largeBottleDepositPaise / 100).toFixed(0) : '—';
  const smallDepositRs = tiers[0] ? (tiers[0].smallBottleDepositPaise / 100).toFixed(0) : '—';

  if (loading && tiers.length === 0) {
    return (
      <AdminLayout>
        <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Products & Pricing</h1>
          <p className="text-gray-600">
            Manage milk prices and bottle deposit amounts. Changes take effect on new deliveries immediately.
          </p>
        </div>

        {successMsg && (
          <Card className="p-4 mb-6 border-2 border-green-500 bg-green-50">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-700" />
              <p className="text-green-900 font-medium">{successMsg}</p>
            </div>
          </Card>
        )}

        {error && (
          <Card className="p-4 mb-6 border-2 border-red-500 bg-red-50">
            <p className="text-red-900">{error}</p>
          </Card>
        )}

        {/* ─── Milk Pricing Table ─── */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Milk Pricing</h2>
        <Card className="overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Daily Price</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(tier => (
                  <tr key={tier.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <span className="font-semibold text-gray-900">{tier.label}</span>
                      <span className="text-sm text-gray-500 ml-2">({tier.quantityMl}ml)</span>
                    </td>

                    {editingPriceId === tier.id ? (
                      <>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              value={editPriceRs}
                              onChange={e => setEditPriceRs(e.target.value)}
                              className="w-24 px-2 py-1 border-2 border-green-300 rounded text-right font-semibold focus:border-green-500 outline-none"
                              step="0.5"
                              min="1"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') savePriceEdit(); if (e.key === 'Escape') cancelPriceEdit(); }}
                            />
                            <span className="text-sm text-gray-500">/day</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={savePriceEdit}
                              disabled={savingPrice}
                              className="p-2 bg-green-100 hover:bg-green-200 rounded-lg text-green-800 disabled:opacity-50"
                              title="Save"
                            >
                              {savingPrice
                                ? <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                                : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={cancelPriceEdit}
                              disabled={savingPrice}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-4 text-right">
                          <span className="text-lg font-bold text-green-800">
                            ₹{(tier.dailyPricePaise / 100).toFixed(0)}
                          </span>
                          <span className="text-sm text-gray-500">/day</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => startPriceEdit(tier)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-green-800"
                              title="Edit price"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ─── Bottle Deposits Card ─── */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Bottle Deposits</h2>
        <Card className="p-6 mb-8">
          {editingDeposit ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-600 mb-1">1L Bottle Deposit</label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">₹</span>
                  <input
                    type="number"
                    value={editLargeDepositRs}
                    onChange={e => setEditLargeDepositRs(e.target.value)}
                    className="w-28 px-3 py-2 border-2 border-green-300 rounded-lg text-right font-semibold focus:border-green-500 outline-none"
                    step="0.5"
                    min="0"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-600 mb-1">500ml Bottle Deposit</label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">₹</span>
                  <input
                    type="number"
                    value={editSmallDepositRs}
                    onChange={e => setEditSmallDepositRs(e.target.value)}
                    className="w-28 px-3 py-2 border-2 border-green-300 rounded-lg text-right font-semibold focus:border-green-500 outline-none"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveDepositEdit}
                  disabled={savingDeposit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {savingDeposit
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Check className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={cancelDepositEdit}
                  disabled={savingDeposit}
                  className="px-4 py-2 hover:bg-gray-100 rounded-lg text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-sm text-gray-500 mb-1">1L Bottle</p>
                  <p className="text-2xl font-bold text-gray-900">₹{largeDepositRs}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">500ml Bottle</p>
                  <p className="text-2xl font-bold text-gray-900">₹{smallDepositRs}</p>
                </div>
              </div>
              <button
                onClick={startDepositEdit}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-green-800 font-medium"
                title="Edit deposits"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-4">
            Charged when a customer is first approved, then every 90 deliveries. Amount = deposit per bottle × 2 bottles × number of bottles in subscription.
          </p>
        </Card>

        {/* ─── Info Card ─── */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-3">How pricing works</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-800 font-bold mt-0.5">1.</span>
              <span><strong>Daily Price</strong> is charged per delivery. Changing it applies to new deliveries immediately.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-800 font-bold mt-0.5">2.</span>
              <span><strong>Bottle Deposit</strong> is the same for all subscription tiers. It is charged per bottle type, not per quantity.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-800 font-bold mt-0.5">3.</span>
              <span>Customers and the home page will see updated prices within 5 minutes of changes (cached).</span>
            </li>
          </ul>
        </Card>
      </div>
    </AdminLayout>
  );
};

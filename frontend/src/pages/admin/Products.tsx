import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ dailyPriceRs: '', largeDepositRs: '', smallDepositRs: '' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const startEdit = (tier: ProductTier) => {
    setEditingId(tier.id);
    setEditValues({
      dailyPriceRs: (tier.dailyPricePaise / 100).toString(),
      largeDepositRs: (tier.largeBottleDepositPaise / 100).toString(),
      smallDepositRs: (tier.smallBottleDepositPaise / 100).toString(),
    });
    setSuccessMsg(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ dailyPriceRs: '', largeDepositRs: '', smallDepositRs: '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const dailyPriceRs = parseFloat(editValues.dailyPriceRs);
    const largeDepositRs = parseFloat(editValues.largeDepositRs);
    const smallDepositRs = parseFloat(editValues.smallDepositRs);

    if (isNaN(dailyPriceRs) || dailyPriceRs <= 0) {
      setError('Daily price must be a positive number');
      return;
    }
    if (isNaN(largeDepositRs) || largeDepositRs < 0) {
      setError('Large bottle deposit must be >= 0');
      return;
    }
    if (isNaN(smallDepositRs) || smallDepositRs < 0) {
      setError('Small bottle deposit must be >= 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetchWithCsrf(`/api/admin/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyPricePaise: Math.round(dailyPriceRs * 100),
          largeBottleDepositPaise: Math.round(largeDepositRs * 100),
          smallBottleDepositPaise: Math.round(smallDepositRs * 100),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update pricing');
      }

      setSuccessMsg('Pricing updated successfully. New deliveries will use the updated price.');
      setEditingId(null);
      fetchProducts();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

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

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Daily Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">1L Bottle Deposit</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">500ml Bottle Deposit</th>
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

                    {editingId === tier.id ? (
                      <>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              value={editValues.dailyPriceRs}
                              onChange={e => setEditValues(v => ({ ...v, dailyPriceRs: e.target.value }))}
                              className="w-24 px-2 py-1 border-2 border-green-300 rounded text-right font-semibold focus:border-green-500 outline-none"
                              step="0.5"
                              min="1"
                              autoFocus
                            />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              value={editValues.largeDepositRs}
                              onChange={e => setEditValues(v => ({ ...v, largeDepositRs: e.target.value }))}
                              className="w-24 px-2 py-1 border-2 border-green-300 rounded text-right font-semibold focus:border-green-500 outline-none"
                              step="0.5"
                              min="0"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              value={editValues.smallDepositRs}
                              onChange={e => setEditValues(v => ({ ...v, smallDepositRs: e.target.value }))}
                              className="w-24 px-2 py-1 border-2 border-green-300 rounded text-right font-semibold focus:border-green-500 outline-none"
                              step="0.5"
                              min="0"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-2 bg-green-100 hover:bg-green-200 rounded-lg text-green-800 disabled:opacity-50"
                              title="Save"
                            >
                              {saving
                                ? <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                                : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
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
                        <td className="py-4 px-4 text-right">
                          <span className="font-medium text-gray-700">
                            ₹{(tier.largeBottleDepositPaise / 100).toFixed(0)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-medium text-gray-700">
                            ₹{(tier.smallBottleDepositPaise / 100).toFixed(0)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => startEdit(tier)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-green-800"
                              title="Edit pricing"
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

        <Card className="p-6 mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">How pricing works</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-800 font-bold mt-0.5">1.</span>
              <span><strong>Daily Price</strong> is charged per delivery. Changing it applies to new deliveries only (past deliveries keep their original price).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-800 font-bold mt-0.5">2.</span>
              <span><strong>Bottle Deposit</strong> is charged when a customer is first approved, then every 90 deliveries. The deposit amount = (deposit per bottle type) × 2 bottles × number of bottles in subscription.</span>
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

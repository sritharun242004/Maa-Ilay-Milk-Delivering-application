import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDateLocal } from '../../lib/date';
import { Plus, X, Wallet as WalletIcon, Info, Check } from 'lucide-react';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';

type WalletData = {
  balancePaise: number;
  balanceRs: string;
  lastTransactionAt: string | null;
  transactions: {
    id: string;
    type: string;
    amountPaise: number;
    amountRs: string;
    balanceAfterPaise: number;
    balanceAfterRs: string;
    description: string;
    createdAt: string;
  }[];
};

export const Wallet: React.FC = () => {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMoneyError, setAddMoneyError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = () => {
    setLoading(true);
    fetch('/api/customer/wallet', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load wallet');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false));
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMoneyError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAddMoneyError('Please enter a valid amount');
      return;
    }

    if (amountNum < 10) {
      setAddMoneyError('Minimum amount is ₹10');
      return;
    }

    if (amountNum > 100000) {
      setAddMoneyError('Maximum amount is ₹1,00,000');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetchWithCsrf('/api/customer/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRs: amountNum }),
      });

      if (response.ok) {
        setSuccess(true);
        setShowAddMoney(false);
        setAmount('');
        fetchWallet(); // Refresh wallet data
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        if (data.error?.includes('CSRF')) {
          // Clear cached token and show refresh message
          clearCsrfToken();
          setAddMoneyError('Invalid CSRF token. Please refresh the page and try again.');
        } else {
          setAddMoneyError(data.error || 'Failed to add money');
        }
      }
    } catch (err) {
      setAddMoneyError('Failed to add money. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isCredit = (type: string) => type === 'WALLET_TOPUP' || (typeof type === 'string' && type.toLowerCase().includes('top') || type.toLowerCase().includes('credit'));

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  if (error || !data) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-red-600">{error ?? 'Could not load wallet'}</p>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Wallet</h1>
            <p className="text-gray-600">Manage your balance and view transactions</p>
          </div>
          <Button
            onClick={() => setShowAddMoney(true)}
            icon={Plus}
            className="flex items-center gap-2"
          >
            Add Money
          </Button>
        </div>

        {/* Success Message */}
        {success && (
          <Card className="p-6 mb-6 border-2 border-emerald-500 bg-emerald-50">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-emerald-600" />
              <p className="font-semibold text-emerald-900">Money added successfully!</p>
            </div>
          </Card>
        )}

        {/* Wallet Balance Card */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-3xl p-10 shadow-2xl mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <WalletIcon className="w-6 h-6 text-emerald-100" />
              <p className="text-emerald-100">Available Balance</p>
            </div>
            <p className="text-6xl font-bold mb-4">₹{Number(data.balanceRs).toLocaleString('en-IN')}</p>
            <p className="text-emerald-100 text-sm">
              {data.lastTransactionAt
                ? `Last transaction: ${formatDateLocal(data.lastTransactionAt, 'short')}`
                : 'No transactions yet'}
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="p-6 mb-8 border-l-4 border-blue-500 bg-blue-50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How wallet works:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Add money to your wallet using the "Add Money" button</li>
                <li>Money is automatically deducted after each delivery</li>
                <li>Ensure sufficient balance to continue receiving deliveries</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Transaction History */}
        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Transaction History</h2>

          {data.transactions.length === 0 ? (
            <div className="text-center py-12">
              <WalletIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-2">Add money to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Type</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm">{formatDateLocal(txn.createdAt, 'short')}</td>
                      <td className="py-4 px-4 text-sm">{txn.description}</td>
                      <td className="py-4 px-4">
                        <span className={`text-sm font-medium ${isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.type === 'WALLET_TOPUP' ? 'Credit' : txn.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-right font-semibold ${isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.amountPaise >= 0 ? '+' : ''}₹{txn.amountRs}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold">₹{txn.balanceAfterRs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add Money Modal */}
        {showAddMoney && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-8 relative">
              <button
                onClick={() => {
                  setShowAddMoney(false);
                  setAmount('');
                  setAddMoneyError('');
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Money to Wallet</h2>

              <form onSubmit={handleAddMoney}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">₹</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      min="10"
                      max="100000"
                      step="1"
                      className="w-full pl-10 pr-4 py-4 text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum: ₹10 | Maximum: ₹1,00,000</p>
                </div>

                {/* Quick amount buttons */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">Quick amounts:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt.toString())}
                        className="py-2 px-3 text-sm font-medium border-2 border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {addMoneyError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{addMoneyError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!amount || submitting}
                    loading={submitting}
                    className="flex-1"
                  >
                    {submitting ? 'Processing...' : `Add ₹${amount || '0'}`}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddMoney(false);
                      setAmount('');
                      setAddMoneyError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <Info className="w-4 h-4 inline mr-1" />
                  In production, this will integrate with a payment gateway. Currently, money is added directly for testing.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDateLocal } from '../../lib/date';
import { Plus, X, Wallet as WalletIcon, Info, Check } from 'lucide-react';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

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
    fetch(getApiUrl('/api/customer/wallet'), { credentials: 'include' })
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

    if (amountNum < 1) {
      setAddMoneyError('Minimum amount is ₹1');
      return;
    }

    if (amountNum > 100000) {
      setAddMoneyError('Maximum amount is ₹1,00,000');
      return;
    }

    setSubmitting(true);

    try {
      // Create payment order with Cashfree
      const response = await fetchWithCsrf('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaise: Math.round(amountNum * 100) }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error?.includes('CSRF')) {
          clearCsrfToken();
          setAddMoneyError('Invalid CSRF token. Please refresh the page and try again.');
        } else {
          setAddMoneyError(data.error || 'Failed to create payment order');
        }
        setSubmitting(false);
        return;
      }

      const data = await response.json();

      console.log('Payment order response:', data);

      if (!data.success || !data.paymentSessionId) {
        console.error('Payment initiation failed:', data);
        setAddMoneyError(data.error || 'Failed to initiate payment. Check console for details.');
        setSubmitting(false);
        return;
      }

      // Initialize Cashfree Checkout (v3 SDK)
      // @ts-ignore - Cashfree SDK loaded via CDN
      if (typeof window.Cashfree === 'undefined') {
        setAddMoneyError('Payment gateway not loaded. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      console.log('Initializing Cashfree checkout');
      console.log('Payment Session ID:', data.paymentSessionId);
      console.log('Order ID:', data.orderId);

      // @ts-ignore - Cashfree v3 SDK
      const cashfree = window.Cashfree({
        mode: 'sandbox' // Always sandbox for now (change to 'production' for live)
      });

      // Redirect to Cashfree payment page with order_id in return URL
      const returnUrl = `${window.location.origin}/payment/callback?order_id=${data.orderId}`;
      console.log('Return URL:', returnUrl);

      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        returnUrl: returnUrl,
        redirectTarget: '_self' // Open in same tab
      }).then(() => {
        console.log('Cashfree checkout initiated successfully');
      }).catch((error: any) => {
        console.error('Cashfree checkout error:', error);
        setAddMoneyError('Failed to open payment page. Please try again.');
        setSubmitting(false);
      });

      // The user will be redirected to Cashfree payment page
      // After payment, they'll be redirected back to /payment/callback

    } catch (err) {
      console.error('Payment error:', err);
      setAddMoneyError('Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  };

  const isCredit = (type: string) => type === 'WALLET_TOPUP' || (typeof type === 'string' && type.toLowerCase().includes('top') || type.toLowerCase().includes('credit'));

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
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
          <Card className="p-6 mb-6 border-2 border-green-500 bg-green-50">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-green-800" />
              <p className="font-semibold text-green-950">Money added successfully!</p>
            </div>
          </Card>
        )}

        {/* Wallet Balance Card */}
        <div className="relative bg-gray-900 text-white rounded-lg p-8 shadow-sm mb-8 overflow-hidden">
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <WalletIcon className="w-6 h-6 text-gray-300" />
              <p className="text-gray-300">Available Balance</p>
            </div>
            <p className="text-6xl font-bold mb-4">₹{Number(data.balanceRs).toLocaleString('en-IN')}</p>
            <p className="text-gray-300 text-sm">
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
                      min="1"
                      max="100000"
                      step="1"
                      className="w-full pl-10 pr-4 py-4 text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum: ₹1 | Maximum: ₹1,00,000</p>
                </div>

                {/* Quick amount buttons */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">Quick amounts:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 10, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt.toString())}
                        className="py-2 px-3 text-sm font-medium border-2 border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
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
                  <strong>TEST MODE:</strong> No real money will be charged. Use test card 4111 1111 1111 1111 for testing.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDateLocal } from '../../lib/date';
import { Wallet as WalletIcon, Info, Check, AlertCircle } from 'lucide-react';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';
import { getMonthName } from '../../config/pricing';

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

type NextMonthPreview = {
  isPreviewAvailable: boolean;
  nextMonth?: number;
  nextYear?: number;
  nextMonthName?: string;
  dailyRateRs?: number;
  daysInNextMonth?: number;
  nextMonthCostRs?: number;
  currentBalanceRs?: number;
  remainingChargesRs?: number;
  projectedBalanceRs?: number;
  shortfallRs?: number;
  shortfallPaise?: number;
  walletCoversNextMonth?: boolean;
  deliveryCount?: number;
  deliveriesUntilNextDeposit?: number;
  bottleDepositRs?: number;
  depositsInNextMonth?: number;
  depositChargeRs?: number;
};

type MonthlyPaymentData = {
  hasSubscription: boolean;
  year?: number;
  month?: number;
  dailyRateRs?: number;
  daysInMonth?: number;
  totalCostRs?: number;
  walletBalanceRs?: number;
  amountDueRs?: number;
  amountDuePaise?: number;
  status?: string;
  paidAt?: string | null;
  isGracePeriod?: boolean;
  dailyQuantityMl?: number;
};

export const Wallet: React.FC = () => {
  const [data, setData] = useState<WalletData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyPaymentData | null>(null);
  const [nextMonthPreview, setNextMonthPreview] = useState<NextMonthPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [payError, setPayError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load wallet first (critical) — show page as soon as it resolves
    fetchWallet().finally(() => setLoading(false));
    // Load non-critical data in background (won't block page render)
    fetchMonthlyStatus();
    fetchNextMonthPreview();
  }, []);

  const fetchWithTimeout = (url: string, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { credentials: 'include', signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  const fetchWallet = () => {
    return fetchWithTimeout(getApiUrl('/api/customer/wallet'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load wallet');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load wallet'));
  };

  const fetchMonthlyStatus = () => {
    return fetchWithTimeout(getApiUrl('/api/customer/monthly-payment-status'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load monthly status');
        return res.json();
      })
      .then(setMonthlyData)
      .catch(() => {}); // Non-critical
  };

  const fetchNextMonthPreview = () => {
    return fetchWithTimeout(getApiUrl('/api/customer/next-month-preview'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load preview');
        return res.json();
      })
      .then(setNextMonthPreview)
      .catch(() => {}); // Non-critical
  };

  const handlePayAdvance = async () => {
    setPayError('');
    setAdvanceSubmitting(true);

    try {
      const response = await fetchWithCsrf('/api/payment/create-advance-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData.error?.includes('CSRF')) {
          clearCsrfToken();
          setPayError('Session expired. Please refresh the page and try again.');
        } else {
          setPayError(errData.error || 'Failed to create advance payment order');
        }
        setAdvanceSubmitting(false);
        return;
      }

      const result = await response.json();

      if (result.alreadyCovered) {
        setSuccess(true);
        fetchWallet();
        fetchNextMonthPreview();
        setAdvanceSubmitting(false);
        setTimeout(() => setSuccess(false), 5000);
        return;
      }

      if (!result.paymentSessionId) {
        setPayError('Failed to initiate payment. Please try again.');
        setAdvanceSubmitting(false);
        return;
      }

      // @ts-ignore
      if (typeof window.Cashfree === 'undefined') {
        setPayError('Payment gateway not loaded. Please refresh and try again.');
        setAdvanceSubmitting(false);
        return;
      }

      // @ts-ignore
      const cashfree = window.Cashfree({ mode: 'production' });

      cashfree.checkout({
        paymentSessionId: result.paymentSessionId,
        returnUrl: `${window.location.origin}/payment/callback?order_id=${result.orderId}`,
        redirectTarget: '_self',
      }).catch(() => {
        setPayError('Failed to open payment page. Please try again.');
        setAdvanceSubmitting(false);
      });
    } catch {
      setPayError('Failed to initiate advance payment. Please try again.');
      setAdvanceSubmitting(false);
    }
  };

  const handlePayForMonth = async () => {
    setPayError('');
    setSubmitting(true);

    try {
      const response = await fetchWithCsrf('/api/payment/create-monthly-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData.error?.includes('CSRF')) {
          clearCsrfToken();
          setPayError('Session expired. Please refresh the page and try again.');
        } else {
          setPayError(errData.error || 'Failed to create payment order');
        }
        setSubmitting(false);
        return;
      }

      const result = await response.json();

      if (result.alreadyCovered) {
        // Wallet covered the full month
        setSuccess(true);
        fetchWallet();
        fetchMonthlyStatus();
        setSubmitting(false);
        setTimeout(() => setSuccess(false), 5000);
        return;
      }

      if (!result.paymentSessionId) {
        setPayError('Failed to initiate payment. Please try again.');
        setSubmitting(false);
        return;
      }

      // @ts-ignore
      if (typeof window.Cashfree === 'undefined') {
        setPayError('Payment gateway not loaded. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      // @ts-ignore
      const cashfree = window.Cashfree({ mode: 'production' });

      cashfree.checkout({
        paymentSessionId: result.paymentSessionId,
        returnUrl: `${window.location.origin}/payment/callback?order_id=${result.orderId}`,
        redirectTarget: '_self',
      }).catch(() => {
        setPayError('Failed to open payment page. Please try again.');
        setSubmitting(false);
      });
    } catch {
      setPayError('Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  };

  const isCredit = (type: string) =>
    type === 'WALLET_TOPUP' || type === 'MONTHLY_PAYMENT' || type === 'ADMIN_CREDIT' || type === 'REFUND' || type === 'REFERRAL_CREDIT';

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

  const mp = monthlyData;
  const isPaid = mp?.status === 'PAID';
  const isOverdue = mp?.status === 'OVERDUE';
  const isPending = mp?.status === 'PENDING';
  const monthName = mp?.month ? getMonthName(mp.month) : '';
  const yearStr = mp?.year ?? '';

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">Wallet</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage your monthly payment and view transactions</p>
        </div>

        {/* Success Message */}
        {success && (
          <Card className="p-6 mb-6 border-2 border-green-500 bg-green-50">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-green-800" />
              <p className="font-semibold text-green-950">
                {monthName} payment completed! Your wallet balance covers the full month.
              </p>
            </div>
          </Card>
        )}

        {/* Wallet Balance Card */}
        <div className="relative bg-gray-900 text-white rounded-lg p-5 sm:p-8 shadow-sm mb-8 overflow-hidden">
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <WalletIcon className="w-6 h-6 text-gray-300" />
              <p className="text-gray-300">Wallet Balance</p>
            </div>
            <p className="text-4xl sm:text-6xl font-bold mb-4">₹{Number(data.balanceRs).toLocaleString('en-IN')}</p>
            <p className="text-gray-300 text-sm">
              {data.lastTransactionAt
                ? `Last transaction: ${formatDateLocal(data.lastTransactionAt, 'short')}`
                : 'No transactions yet'}
            </p>
          </div>
        </div>

        {/* Monthly Payment Section */}
        {mp?.hasSubscription && (
          <Card className={`p-6 mb-8 border-2 ${isPaid ? 'border-green-500 bg-green-50' : isOverdue ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'}`}>
            <div className="flex items-start gap-3 mb-4">
              {isPaid ? (
                <Check className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
              ) : isOverdue ? (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {isPaid
                    ? `${monthName} ${yearStr} — Paid`
                    : isOverdue
                    ? `${monthName} ${yearStr} — Overdue`
                    : `Pay for ${monthName} ${yearStr}`}
                </h3>
                {isPaid && mp.paidAt && (
                  <p className="text-sm text-green-800">
                    Paid on {formatDateLocal(mp.paidAt, 'short')}
                  </p>
                )}
                {isOverdue && (
                  <p className="text-sm text-red-800">
                    Payment is overdue. Your deliveries are paused until payment is completed.
                  </p>
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white/60 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily rate</span>
                  <span className="font-medium">₹{mp.dailyRateRs}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Days in {monthName}</span>
                  <span className="font-medium">{mp.daysInMonth} days</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700 font-medium">Monthly total</span>
                  <span className="font-bold">₹{mp.totalCostRs?.toFixed(2)}</span>
                </div>
                {!isPaid && (
                  <>
                    <div className="flex justify-between text-green-700">
                      <span>Wallet balance</span>
                      <span>- ₹{mp.walletBalanceRs?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg">
                      <span className="font-semibold text-gray-900">Amount due</span>
                      <span className="font-bold text-gray-900">
                        ₹{(mp.amountDueRs ?? 0) > 0 ? mp.amountDueRs?.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pay Button */}
            {!isPaid && (
              <>
                {payError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{payError}</p>
                  </div>
                )}
                <Button
                  onClick={handlePayForMonth}
                  disabled={submitting}
                  loading={submitting}
                  className="w-full"
                >
                  {submitting
                    ? 'Processing...'
                    : (mp.amountDueRs ?? 0) > 0
                    ? `Pay ₹${mp.amountDueRs?.toFixed(2)} for ${monthName}`
                    : `Confirm Payment for ${monthName}`}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* Next Month Preview */}
        {nextMonthPreview?.isPreviewAvailable && (
          <Card className={`p-6 mb-8 border-2 ${nextMonthPreview.walletCoversNextMonth ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}>
            <div className="flex items-start gap-3 mb-4">
              {nextMonthPreview.walletCoversNextMonth ? (
                <Check className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {nextMonthPreview.walletCoversNextMonth
                    ? `Your wallet covers ${nextMonthPreview.nextMonthName} ${nextMonthPreview.nextYear}`
                    : `Prepare for ${nextMonthPreview.nextMonthName} ${nextMonthPreview.nextYear}`}
                </h3>
                {nextMonthPreview.walletCoversNextMonth ? (
                  <p className="text-sm text-green-800">
                    Your projected balance will cover next month's subscription. It will be auto-deducted on the 1st.
                  </p>
                ) : (
                  <p className="text-sm text-amber-800">
                    Pay the shortfall now so next month starts seamlessly on the 1st.
                  </p>
                )}
              </div>
            </div>

            {!nextMonthPreview.walletCoversNextMonth && (
              <>
                <div className="bg-white/60 rounded-lg p-4 mb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily rate</span>
                      <span className="font-medium">₹{nextMonthPreview.dailyRateRs}/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days in {nextMonthPreview.nextMonthName}</span>
                      <span className="font-medium">{nextMonthPreview.daysInNextMonth} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Milk charges</span>
                      <span className="font-medium">₹{((nextMonthPreview.dailyRateRs ?? 0) * (nextMonthPreview.daysInNextMonth ?? 0)).toFixed(2)}</span>
                    </div>
                    {(nextMonthPreview.depositsInNextMonth ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Bottle deposit ({nextMonthPreview.depositsInNextMonth}x ₹{nextMonthPreview.bottleDepositRs})
                        </span>
                        <span className="font-medium">₹{nextMonthPreview.depositChargeRs?.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-medium">{nextMonthPreview.nextMonthName} total</span>
                      <span className="font-bold">₹{nextMonthPreview.nextMonthCostRs?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Projected wallet balance</span>
                      <span>₹{(nextMonthPreview.projectedBalanceRs ?? 0) > 0 ? nextMonthPreview.projectedBalanceRs?.toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg">
                      <span className="font-semibold text-gray-900">Shortfall</span>
                      <span className="font-bold text-gray-900">₹{nextMonthPreview.shortfallRs?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {(nextMonthPreview.deliveriesUntilNextDeposit ?? 0) > 0 && (
                  <p className="text-xs text-gray-500 mb-4">
                    {nextMonthPreview.deliveryCount} deliveries completed. Next bottle deposit in {nextMonthPreview.deliveriesUntilNextDeposit} deliveries.
                  </p>
                )}

                {payError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{payError}</p>
                  </div>
                )}
                <Button
                  onClick={handlePayAdvance}
                  disabled={advanceSubmitting || submitting}
                  loading={advanceSubmitting}
                  className="w-full"
                >
                  {advanceSubmitting
                    ? 'Processing...'
                    : `Pay ₹${nextMonthPreview.shortfallRs?.toFixed(2)} for ${nextMonthPreview.nextMonthName}`}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* Info Card */}
        <Card className="p-6 mb-8 border-l-4 border-blue-500 bg-blue-50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How monthly payment works:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Pay your full month's subscription by the <strong>7th of every month</strong></li>
                <li>Your wallet balance is applied automatically toward the monthly cost</li>
                <li>Daily milk charges are deducted from your wallet after each delivery</li>
                <li>If unpaid after the 7th, deliveries will be paused</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Transaction History */}
        <Card className="p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">Transaction History</h2>

          {data.transactions.length === 0 ? (
            <div className="text-center py-12">
              <WalletIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-0">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase">Date</th>
                    <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase">Description</th>
                    <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase">Type</th>
                    <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase hidden sm:table-cell">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">{formatDateLocal(txn.createdAt, 'short')}</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">{txn.description}</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4">
                        <span className={`text-xs sm:text-sm font-medium ${isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.type === 'WALLET_TOPUP' || txn.type === 'MONTHLY_PAYMENT' ? 'Credit' : txn.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={`py-3 sm:py-4 px-3 sm:px-4 text-right font-semibold text-xs sm:text-sm whitespace-nowrap ${isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.amountPaise >= 0 ? '+' : ''}₹{txn.amountRs}
                      </td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-right font-semibold text-sm hidden sm:table-cell">₹{txn.balanceAfterRs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};

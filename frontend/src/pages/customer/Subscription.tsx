import React, { useState, useEffect } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight, Calendar, RefreshCcw } from 'lucide-react';
import { DAILY_QUANTITY_OPTIONS } from '../../config/pricing';
import { getLocalTomorrowISO } from '../../lib/date';

type QuantityOption = (typeof DAILY_QUANTITY_OPTIONS)[number];

function parseDate(s: string): Date {
  const d = new Date(s);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1);
}

export const Subscription: React.FC = () => {
  const [dailyQuantity, setDailyQuantity] = useState<QuantityOption | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/customer/dashboard', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.subscription) {
          setCurrentSub(data.subscription);
          setIsEditing(false);
        } else {
          setIsEditing(true);
        }
        if (data.customer?.walletBalanceRs) {
          setWalletBalance(Number(data.customer.walletBalanceRs));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const tomorrow = getLocalTomorrowISO();

  const minToDate = fromDate || tomorrow;
  const days = fromDate && toDate ? daysBetween(fromDate, toDate) : 0;
  const dailyRs = dailyQuantity?.dailyRs ?? 0;
  const milkAmountRs = days * dailyRs;
  const depositRs = 0;
  const totalRs = milkAmountRs + depositRs;

  // Calculate "Extra" vs "Full" wallet balance usage.
  // Full balance is used for modifications (starting tomorrow) because it replaces the committed balance.
  // Extra balance is used for future renewals (protecting current deliveries).

  const isModification = currentSub && fromDate === tomorrow;

  let committedRs = 0;
  if (currentSub && currentSub.endDate) {
    const todayEnd = new Date();
    todayEnd.setHours(0, 0, 0, 0);
    const subEnd = new Date(currentSub.endDate);
    subEnd.setHours(0, 0, 0, 0);
    const tmrw = new Date(todayEnd);
    tmrw.setDate(tmrw.getDate() + 1);

    if (subEnd >= tmrw) {
      const remainingDays = Math.round((subEnd.getTime() - tmrw.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      committedRs = remainingDays * (Number(currentSub.dailyPriceRs) || 0);
    }
  }

  const usableBalance = isModification ? walletBalance : Math.max(0, walletBalance - committedRs);
  const netTotalRs = Math.max(0, totalRs - usableBalance);

  const handleStartSubscribe = () => {
    if (!dailyQuantity) return;
    setShowDateRange(true);
    if (!fromDate) setFromDate(tomorrow);
  };

  const handlePay = async () => {
    if (!dailyQuantity || !fromDate || !toDate) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dailyQuantityMl: Math.round(dailyQuantity.liters * 1000),
          startDate: fromDate,
          endDate: toDate,
          amountToPayRs: netTotalRs,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start subscription');
      }

      const data = await res.json();
      alert(`Payment successful! ₹${data.transaction.amountRs} has been added to your wallet and your subscription is now active.`);
      navigate('/customer/dashboard');
    } catch (err: any) {
      alert(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = () => {
    if (!currentSub) return;

    // Find matching quantity option
    const quantity = DAILY_QUANTITY_OPTIONS.find(
      opt => Math.round(opt.liters * 1000) === currentSub.dailyQuantityMl
    ) || DAILY_QUANTITY_OPTIONS[1]; // default 1L

    // Calculate next period
    const currentEnd = new Date(currentSub.endDate || new Date());
    const nextStart = new Date(currentEnd);
    nextStart.setDate(nextStart.getDate() + 1);

    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 30); // Pre-fill 1 month

    setDailyQuantity(quantity as QuantityOption);
    setFromDate(nextStart.toISOString().slice(0, 10));
    setToDate(nextEnd.toISOString().slice(0, 10));
    setShowDateRange(true);
    setIsEditing(true);
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-gray-600 font-medium">Loading subscription...</span>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Subscription</h1>
          <p className="text-gray-600">Choose daily quantity and subscription period</p>
        </div>

        {currentSub && (
          <Card variant="gradient" className="p-8 mb-8 border-2 border-emerald-200">
            <Badge variant="success" className="mb-4">
              Current Plan
            </Badge>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Quantity</p>
                <p className="text-xl font-bold text-gray-900">{currentSub.dailyQuantityMl / 1000}L per day</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Cost</p>
                <p className="text-xl font-bold text-emerald-600">₹{currentSub.dailyPriceRs}/day</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Balance Covers</p>
                <p className="text-xl font-bold text-emerald-700">
                  {(() => {
                    const dailyPrice = Number(currentSub.dailyPriceRs);
                    const days = dailyPrice > 0 ? Math.floor(walletBalance / dailyPrice) : 0;

                    if (days <= 0) return '0 Days';

                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + days);

                    return `${days} Days (until ${formatDate(endDate.toISOString())})`;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge variant="success">{currentSub.subscriptionStatusDisplay || 'Active'}</Badge>
              </div>
            </div>
            {!isEditing && (
              <div className="flex gap-4 mt-6">
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  Modify Plan
                </Button>
                <Button variant="secondary" icon={RefreshCcw} onClick={handleRenew}>
                  Renew for next month
                </Button>
              </div>
            )}
            {isEditing && (
              <Button variant="secondary" className="mt-6" onClick={() => setIsEditing(false)}>
                Cancel Modification
              </Button>
            )}
          </Card>
        )}

        {isEditing && (
          <>
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Quantity</h2>
              <p className="text-gray-600 mb-6">Select how many liters you want per day (0.5L to 4L)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {DAILY_QUANTITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.liters}
                    type="button"
                    onClick={() => setDailyQuantity(opt)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${dailyQuantity?.liters === opt.liters
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-gray-200 hover:border-emerald-300 bg-white'
                      }`}
                  >
                    <p className="text-2xl font-bold text-gray-900">{opt.label}</p>
                    <p className="text-lg font-semibold text-emerald-600 mt-1">₹{opt.dailyRs}/day</p>
                  </button>
                ))}
              </div>
            </Card>

            <div className="flex flex-wrap gap-4 mb-8">
              {currentSub && dailyQuantity && (
                <Button
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  icon={RefreshCcw}
                  onClick={() => {
                    setFromDate(tomorrow);
                    setToDate(currentSub.endDate.split('T')[0]);
                    setShowDateRange(true);
                  }}
                >
                  Apply to remaining days (until {formatDate(currentSub.endDate)})
                </Button>
              )}
              <Button
                variant="secondary"
                icon={ArrowRight}
                onClick={handleStartSubscribe}
                disabled={!dailyQuantity}
              >
                Custom Date Range
              </Button>
            </div>
            {showDateRange && dailyQuantity && (
              <Card className="p-8 mb-8 border-l-4 border-emerald-500">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-emerald-600" />
                  Select subscription period
                </h3>
                <p className="text-gray-600 mb-6">
                  Choose from date and to date. Example: from 30 Jan to 29 Feb. Payment is calculated for the number of days in this range.
                </p>
                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From date</label>
                    <input
                      type="date"
                      value={fromDate}
                      min={tomorrow}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To date</label>
                    <input
                      type="date"
                      value={toDate}
                      min={minToDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    />
                  </div>
                </div>
                {fromDate && toDate && days > 0 && (
                  <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Payment summary (all in ₹)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex justify-between">
                        <span>{days} days × ₹{dailyQuantity.dailyRs}/day</span>
                        <span>₹{milkAmountRs.toLocaleString('en-IN')}</span>
                      </li>
                      {depositRs > 0 && (
                        <li className="flex justify-between">
                          <span>Bottle deposit (if first time)</span>
                          <span>₹{depositRs.toLocaleString('en-IN')}</span>
                        </li>
                      )}
                      <li className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Total amount for new plan</span>
                        <span>₹{totalRs.toLocaleString('en-IN')}</span>
                      </li>
                      <li className="flex justify-between text-emerald-600 font-medium">
                        <span>{isModification ? 'Wallet balance (Transfer to new plan)' : 'Extra wallet balance (used)'}</span>
                        <span>- ₹{Math.min(usableBalance, totalRs).toLocaleString('en-IN')}</span>
                      </li>
                      <li className="flex justify-between text-2xl font-bold text-gray-900 pt-2 border-t-2 border-emerald-500">
                        <span>{netTotalRs > 0 ? 'Extra amount to pay' : 'No extra payment needed'}</span>
                        <span>₹{netTotalRs.toLocaleString('en-IN')}</span>
                      </li>
                    </ul>
                    <Button
                      className="mt-6 w-full sm:w-auto"
                      icon={ArrowRight}
                      onClick={handlePay}
                      disabled={submitting}
                    >
                      {submitting ? 'Processing...' : `Pay ₹${netTotalRs.toLocaleString('en-IN')} & start subscription`}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        <Card className="p-6 mb-8 border-l-4 border-emerald-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment schedule</h3>
          <p className="text-sm text-gray-600 mb-2">Payment date is the <strong>5th of every month</strong>. Amount is calculated for the days in your selected period; after that, renew before 5th for the next month.</p>
        </Card>

        <Card className="mb-8 overflow-hidden">
          <button
            onClick={() => setRulesOpen(!rulesOpen)}
            className="w-full p-6 flex items-center justify-between bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <span className="font-semibold text-gray-900">Subscription Rules</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
          </button>
          {rulesOpen && (
            <div className="px-6 pb-6 pt-4">
              <ul className="space-y-3 text-gray-700">
                <li>• Daily delivery by 6 AM</li>
                <li>• Cutoff time for changes: 5 PM previous day</li>
                <li>• Maximum 4 liters per day</li>
                <li>• Pause up to 5 days per month</li>
                <li>• Bottle deposit charged every 90 days when applicable</li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout >
  );
};

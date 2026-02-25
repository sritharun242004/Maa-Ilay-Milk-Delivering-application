import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ChevronDown, Check, Info, Droplet } from 'lucide-react';
import { usePricing } from '../../hooks/usePricing';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

type QuantityOption = { liters: number; label: string; dailyRs: number };

type DashboardData = {
  subscription: {
    dailyQuantityMl: number;
    dailyPriceRs: string;
    status: string;
    subscriptionStatusDisplay: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | null;
  } | null;
  customer: {
    walletBalanceRs: string;
    status: string;
  };
};

type FirstPaymentPreview = {
  dailyRateRs: number;
  remainingDays: number;
  milkCostRs: number;
  depositRs: number;
  totalRs: number;
  startDate: string;
};

export const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const { quantityOptions } = usePricing();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuantity, setSelectedQuantity] = useState<QuantityOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [firstPaymentPreview, setFirstPaymentPreview] = useState<FirstPaymentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = () => {
    setLoading(true);
    fetch(getApiUrl('/api/customer/dashboard'), { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setDashboardData(data);
        if (data.subscription) {
          const currentOption = quantityOptions.find(
            (opt) => opt.liters === data.subscription.dailyQuantityMl / 1000
          );
          if (currentOption) setSelectedQuantity(currentOption);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load subscription data');
        setLoading(false);
      });
  };

  const isNewCustomer = dashboardData?.customer?.status === 'VISITOR';

  // Fetch first payment preview when new customer selects quantity
  useEffect(() => {
    if (!isNewCustomer || !selectedQuantity) {
      setFirstPaymentPreview(null);
      return;
    }

    setPreviewLoading(true);
    const quantityMl = selectedQuantity.liters * 1000;
    fetch(getApiUrl(`/api/payment/first-payment-preview?dailyQuantityMl=${quantityMl}`), { credentials: 'include' })
      .then((res) => res.json())
      .then(setFirstPaymentPreview)
      .catch(() => setFirstPaymentPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [isNewCustomer, selectedQuantity]);

  const handleFirstPayment = async () => {
    if (!selectedQuantity) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithCsrf('/api/payment/create-first-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyQuantityMl: selectedQuantity.liters * 1000 }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error?.includes('CSRF')) {
          clearCsrfToken();
          setError('Session expired. Please refresh the page and try again.');
        } else {
          setError(data.error || 'Failed to create payment');
        }
        setSubmitting(false);
        return;
      }

      const data = await response.json();

      if (!data.paymentSessionId) {
        setError('Failed to initiate payment. Please try again.');
        setSubmitting(false);
        return;
      }

      // @ts-ignore
      if (typeof window.Cashfree === 'undefined') {
        setError('Payment gateway not loaded. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      // @ts-ignore
      const cashfree = window.Cashfree({ mode: 'production' });

      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        returnUrl: `${window.location.origin}/payment/callback?order_id=${data.orderId}`,
        redirectTarget: '_self',
      }).catch(() => {
        setError('Failed to open payment page. Please try again.');
        setSubmitting(false);
      });
    } catch {
      setError('Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  };

  const handleSubscriptionUpdate = async () => {
    if (!selectedQuantity) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetchWithCsrf('/api/customer/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyQuantityMl: selectedQuantity.liters * 1000,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        fetchDashboard();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        if (data.error?.includes('CSRF')) {
          clearCsrfToken();
          setError('Session expired. Please refresh the page and try again.');
        } else if (data.code === 'PAYMENT_REQUIRED') {
          // Should use first payment flow instead
          handleFirstPayment();
          return;
        } else {
          setError(data.error || 'Failed to update subscription');
        }
      }
    } catch {
      setError('Failed to update subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasSubscription = !!dashboardData?.subscription;
  const subscription = dashboardData?.subscription;
  const walletBalance = Number(dashboardData?.customer?.walletBalanceRs || 0);
  const isQuantityChanged = selectedQuantity &&
    subscription &&
    selectedQuantity.liters !== subscription.dailyQuantityMl / 1000;

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Subscription</h1>
          <p className="text-gray-600">
            {hasSubscription ? 'Manage your daily milk quantity' : 'Start your milk subscription'}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <Card className="p-6 mb-8 border-2 border-green-500 bg-green-50">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-green-800" />
              <div>
                <p className="font-semibold text-green-950">
                  {hasSubscription ? 'Subscription updated successfully!' : 'Subscription started successfully!'}
                </p>
                <p className="text-sm text-green-800">
                  Your daily delivery quantity has been updated.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="p-6 mb-8 border-2 border-red-500 bg-red-50">
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-red-600" />
              <p className="text-red-900">{error}</p>
            </div>
          </Card>
        )}

        {/* Current Subscription Info */}
        {hasSubscription && subscription && (
          <Card variant="gradient" className="p-8 mb-8 border-2 border-green-200">
            <Badge
              variant={
                subscription.subscriptionStatusDisplay === 'ACTIVE'
                  ? 'success'
                  : subscription.subscriptionStatusDisplay === 'PAUSED'
                  ? 'warning'
                  : 'error'
              }
              className="mb-4"
            >
              Current Subscription
            </Badge>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Quantity</p>
                <p className="text-2xl font-bold text-gray-900">
                  {subscription.dailyQuantityMl >= 1000
                    ? `${subscription.dailyQuantityMl / 1000}L per day`
                    : `${subscription.dailyQuantityMl}ml per day`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Cost</p>
                <p className="text-2xl font-bold text-green-800">₹{subscription.dailyPriceRs}/day</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge
                  variant={
                    subscription.subscriptionStatusDisplay === 'ACTIVE'
                      ? 'success'
                      : subscription.subscriptionStatusDisplay === 'PAUSED'
                      ? 'warning'
                      : 'error'
                  }
                >
                  {subscription.subscriptionStatusDisplay || subscription.status}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Paused Status Warning */}
        {hasSubscription && subscription?.subscriptionStatusDisplay === 'PAUSED' && (
          <Card className="p-6 mb-8 border-2 border-yellow-500 bg-yellow-50">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900 mb-2">Delivery Paused</p>
                <p className="text-yellow-800 mb-3">
                  Your next delivery is paused. You can manage your delivery schedule from the Calendar page.
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/customer/calendar')}>
                  Manage Calendar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Wallet Balance Warning */}
        {hasSubscription && subscription?.subscriptionStatusDisplay === 'INACTIVE' && (
          <Card className="p-6 mb-8 border-2 border-orange-500 bg-orange-50">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 mb-2">Subscription Inactive</p>
                <p className="text-orange-800 mb-3">
                  Your subscription is inactive. Please complete your monthly payment to resume deliveries.
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/customer/wallet')}>
                  Pay for Month
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Welcome Message for New Users */}
        {isNewCustomer && (
          <Card className="p-8 mb-8 border-2 border-blue-200 bg-blue-50">
            <div className="flex items-start gap-3">
              <Droplet className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Milk Subscription</h3>
                <p className="text-gray-700 mb-3">
                  Select your daily milk quantity below. You'll pay for the remaining days of this month plus a bottle deposit upfront.
                  Delivery happens every morning between 6-8 AM.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Quantity Selection */}
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {hasSubscription ? 'Change Daily Quantity' : 'Select Daily Quantity'}
          </h2>
          <p className="text-gray-600 mb-6">Choose how much milk you want per day (0.5L to 2.5L)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {quantityOptions.map((opt) => (
              <button
                key={opt.liters}
                type="button"
                onClick={() => setSelectedQuantity(opt)}
                className={`p-6 rounded-xl border-2 text-center transition-all ${
                  selectedQuantity?.liters === opt.liters
                    ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300 bg-white'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900">{opt.label}</p>
                <p className="text-lg font-semibold text-green-800 mt-1">₹{opt.dailyRs}/day</p>
                {selectedQuantity?.liters === opt.liters && (
                  <Check className="w-5 h-5 text-green-800 mx-auto mt-2" />
                )}
              </button>
            ))}
          </div>

          {/* First Payment Preview for New Customers */}
          {isNewCustomer && selectedQuantity && (
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">First Payment Summary</h3>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Calculating...
                </div>
              ) : firstPaymentPreview ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Milk: ₹{firstPaymentPreview.dailyRateRs}/day x {firstPaymentPreview.remainingDays} days</span>
                    <span className="font-medium">₹{firstPaymentPreview.milkCostRs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Bottle deposit (refundable)</span>
                    <span className="font-medium">₹{firstPaymentPreview.depositRs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg border-t pt-3">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-green-800">₹{firstPaymentPreview.totalRs.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Deliveries start from {firstPaymentPreview.startDate}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 flex gap-4">
            {isNewCustomer ? (
              <Button
                onClick={handleFirstPayment}
                disabled={!selectedQuantity || submitting || !firstPaymentPreview}
                loading={submitting}
              >
                {submitting
                  ? 'Processing...'
                  : firstPaymentPreview
                  ? `Pay ₹${firstPaymentPreview.totalRs.toFixed(2)} & Subscribe`
                  : 'Select Quantity to Continue'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSubscriptionUpdate}
                  disabled={!selectedQuantity || submitting || (!isQuantityChanged && hasSubscription)}
                  loading={submitting}
                >
                  {submitting
                    ? 'Saving...'
                    : hasSubscription
                    ? isQuantityChanged
                      ? 'Update Subscription'
                      : 'Select Different Quantity to Update'
                    : 'Start Subscription'}
                </Button>
                {hasSubscription && isQuantityChanged && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const currentOption = quantityOptions.find(
                        (opt) => opt.liters === subscription!.dailyQuantityMl / 1000
                      );
                      setSelectedQuantity(currentOption || null);
                    }}
                  >
                    Cancel Changes
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <Info className="w-4 h-4 inline mr-2" />
              For custom quantity requirements, please contact the admin.
            </p>
          </div>
        </Card>

        {/* Subscription Rules */}
        <Card className="mb-8 overflow-hidden">
          <button
            onClick={() => setRulesOpen(!rulesOpen)}
            className="w-full p-6 flex items-center justify-between bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <span className="font-semibold text-gray-900">Subscription Rules & Information</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
          </button>
          {rulesOpen && (
            <div className="px-6 pb-6 pt-4">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>Daily delivery at <strong>6:00 AM</strong> every morning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>Cutoff time for changes: <strong>4:00 PM</strong> previous day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>Available quantities: <strong>500ml to 2.5L</strong> per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>You can pause delivery anytime from the Calendar page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>Monthly subscription payment is due by the <strong>7th of every month</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>If unpaid after the 7th, deliveries will be paused until payment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">*</span>
                  <span>Bottle deposit is charged with your first payment (refundable)</span>
                </li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};

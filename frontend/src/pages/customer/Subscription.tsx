import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ChevronDown, Check, Info, Droplet } from 'lucide-react';
import { DAILY_QUANTITY_OPTIONS } from '../../config/pricing';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

type QuantityOption = (typeof DAILY_QUANTITY_OPTIONS)[number];

type DashboardData = {
  subscription: {
    dailyQuantityMl: number;
    dailyPriceRs: string;
    status: string;
    subscriptionStatusDisplay: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | null;
  } | null;
  customer: {
    walletBalanceRs: string;
  };
};

export const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuantity, setSelectedQuantity] = useState<QuantityOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = () => {
    setLoading(true);
    fetch(getApiUrl('/api/customer/dashboard'), { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setDashboardData(data);
        // Pre-select current subscription quantity if exists
        if (data.subscription) {
          const currentOption = DAILY_QUANTITY_OPTIONS.find(
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

  const handleSubmit = async () => {
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
        fetchDashboard(); // Refresh data
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        if (data.error?.includes('CSRF')) {
          // Clear cached token and show refresh message
          clearCsrfToken();
          setError('Invalid CSRF token. Please refresh the page and try again.');
        } else {
          setError(data.error || 'Failed to update subscription');
        }
      }
    } catch (err) {
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/customer/calendar')}
                >
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
                <p className="font-semibold text-orange-900 mb-2">Low Wallet Balance</p>
                <p className="text-orange-800 mb-3">
                  Your wallet balance (₹{walletBalance.toFixed(2)}) is insufficient for tomorrow's delivery.
                  Please add money to your wallet to continue receiving deliveries.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/customer/wallet')}
                >
                  Add Money to Wallet
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Welcome Message for New Users */}
        {!hasSubscription && (
          <Card className="p-8 mb-8 border-2 border-blue-200 bg-blue-50">
            <div className="flex items-start gap-3">
              <Droplet className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Milk Subscription</h3>
                <p className="text-gray-700 mb-3">
                  Select your daily milk quantity below. Delivery happens every morning at 6 AM.
                  Money will be deducted from your wallet for each delivery.
                </p>
                <p className="text-sm text-blue-700">
                  💡 <strong>Tip:</strong> Make sure to add money to your wallet after subscribing!
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
            {DAILY_QUANTITY_OPTIONS.map((opt) => (
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

          {/* Submit Button */}
          <div className="mt-8 flex gap-4">
            <Button
              onClick={handleSubmit}
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
                  const currentOption = DAILY_QUANTITY_OPTIONS.find(
                    (opt) => opt.liters === subscription!.dailyQuantityMl / 1000
                  );
                  setSelectedQuantity(currentOption || null);
                }}
              >
                Cancel Changes
              </Button>
            )}
          </div>

          {/* Custom quantity note */}
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
                  <span className="text-green-800 font-bold">•</span>
                  <span>Daily delivery at <strong>6:00 AM</strong> every morning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>Cutoff time for changes: <strong>5:00 PM</strong> previous day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>Available quantities: <strong>500ml to 2.5L</strong> per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>You can pause delivery anytime from the Calendar page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>Money is deducted from your wallet <strong>after each delivery</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>Modify your daily quantity anytime from this page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-800 font-bold">•</span>
                  <span>Add money to your wallet from the <strong>Wallet</strong> page</span>
                </li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};

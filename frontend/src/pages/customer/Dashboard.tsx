import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatDateLocal } from '../../lib/date';
import { getApiUrl } from '../../config/api';
import { getMonthName } from '../../config/pricing';
import {
  Wallet,
  CheckCircle,
  Truck,
  Calendar,
  Package,
  CreditCard,
  Clock,
  HelpCircle,
  Info,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

type DashboardData = {
  customer: {
    walletBalanceRs: string;
    name: string;
    status: string;
  };
  subscription: {
    status: string;
    subscriptionStatusDisplay: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | null;
    pauseDaysUsedThisMonth: number;
  } | null;
  nextPayment: {
    date: string;
    dateDisplay: string;
    amountRs: string;
    days: number;
    description: string;
  } | null;
  monthlyPayment: {
    status: string;
    totalCostPaise: number;
    amountDuePaise: number;
    amountPaidPaise: number;
    dueDate: string;
    paidAt: string | null;
    year: number;
    month: number;
    isGracePeriod: boolean;
    paymentRequired: boolean;
  } | null;
  paymentRequired: boolean;
  isGracePeriod: boolean;
  nextDelivery: { deliveryDate: string } | null;
  balanceCoversDays?: number;
  pauseDaysUsed: number;
  recentTransactions: { type: string; amountPaise: number; createdAt: string; description: string }[];
  nextMonthPreview?: {
    isPreviewAvailable: boolean;
    nextMonth: number;
    nextYear: number;
    nextMonthName: string;
    shortfallRs: number;
    walletCoversNextMonth: boolean;
  } | null;
};

function formatDate(s: string): string {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDateLocal(d, 'short');
}

function lastTopUp(recentTransactions: DashboardData['recentTransactions']): string {
  const topUp = recentTransactions.find((t) => t.type === 'WALLET_TOPUP' || t.type === 'MONTHLY_PAYMENT');
  if (!topUp) return '--';
  const d = new Date(topUp.createdAt);
  const diff = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  if (diff === 2) return '2 days ago';
  if (diff <= 7) return `${diff} days ago`;
  return formatDateLocal(d, 'short');
}

export const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(() => {
    try {
      const cached = sessionStorage.getItem('customer_dashboard');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/customer/dashboard'), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then((d) => {
        setData(d);
        try { sessionStorage.setItem('customer_dashboard', JSON.stringify(d)); } catch {}
      })
      .catch(() => { if (!data) setError('Could not load dashboard'); })
      .finally(() => setLoading(false));
  }, []);

  const pauseDaysUsed = data?.pauseDaysUsed ?? 0;

  const hasSubscription = !!data?.subscription;
  const customerStatus = data?.customer?.status;
  const isPendingPayment = customerStatus === 'PENDING_PAYMENT';
  const isPendingApproval = customerStatus === 'PENDING_APPROVAL';
  const subDisplay = data?.subscription?.subscriptionStatusDisplay;

  const subscriptionLabel = isPendingPayment
    ? 'Pending'
    : isPendingApproval
    ? 'Waiting for Approval'
    : hasSubscription
    ? (subDisplay === 'ACTIVE' ? 'Active' : subDisplay === 'PAUSED' ? 'Paused' : subDisplay === 'INACTIVE' ? 'Inactive' : data?.subscription?.status ?? '--')
    : 'No Subscription';

  const subscriptionBadge = isPendingPayment
    ? undefined
    : isPendingApproval
    ? undefined
    : !hasSubscription
    ? undefined
    : subDisplay === 'INACTIVE'
    ? 'error'
    : subDisplay === 'PAUSED'
    ? 'warning'
    : subDisplay === 'ACTIVE'
    ? 'success'
    : undefined;

  const balanceCoversDays = data?.balanceCoversDays ?? 0;
  const subscriptionSubtext = isPendingPayment
    ? 'Complete subscription'
    : isPendingApproval
    ? undefined
    : !hasSubscription
    ? 'Start your subscription'
    : subDisplay === 'PAUSED'
    ? 'Delivery paused'
    : (subDisplay === 'ACTIVE' && balanceCoversDays === 1 ? '1 day grace period' : undefined);

  // Monthly payment info
  const mp = data?.monthlyPayment;
  const monthName = mp ? getMonthName(mp.month) : '';
  const paymentRequired = data?.paymentRequired ?? false;
  const isMonthPaid = mp?.status === 'PAID';
  const isOverdue = mp?.status === 'OVERDUE';

  const kpiData: { icon: any; label: string; value: string; badge?: string; subtext?: string; valueColor?: string }[] = [
    {
      icon: Wallet,
      label: 'Wallet Balance',
      value: data ? `₹${Number(data.customer.walletBalanceRs).toLocaleString('en-IN')}` : '--',
      subtext: data ? lastTopUp(data.recentTransactions) : '--',
    },
    {
      icon: CheckCircle,
      label: 'Subscription',
      value: subscriptionLabel,
      badge: subscriptionBadge,
      subtext: subscriptionSubtext,
      valueColor: isPendingPayment || !hasSubscription
        ? 'text-red-600'
        : isPendingApproval
        ? 'text-amber-600'
        : undefined,
    },
    {
      icon: Truck,
      label: 'Next Delivery',
      value: data?.nextDelivery ? formatDate(data.nextDelivery.deliveryDate) : '--',
      subtext: data?.nextDelivery
        ? '6:00 AM'
        : isPendingPayment
        ? 'Complete subscription first'
        : isPendingApproval
        ? 'Waiting for admin approval'
        : '--',
    },
    {
      icon: Calendar,
      label: 'Pause Days',
      value: `${pauseDaysUsed}`,
      subtext: 'Days paused this month',
    },
  ];

  const quickActions = [
    {
      icon: Package,
      title: 'Manage Subscription',
      description: 'Change your plan or daily quantity',
      path: '/customer/subscription',
    },
    {
      icon: Calendar,
      title: 'Pause/Block Dates',
      description: 'Manage your delivery calendar',
      path: '/customer/calendar',
    },
    {
      icon: CreditCard,
      title: 'Pay for Month',
      description: 'Monthly subscription payment',
      path: '/customer/wallet',
    },
    {
      icon: Clock,
      title: 'View History',
      description: 'See your delivery and bottle records',
      path: '/customer/history',
    },
    {
      icon: HelpCircle,
      title: 'Get Support',
      description: 'Contact us or view FAQs',
      path: '/customer/support',
    },
  ];

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  if (error || !data) {
    return (
      <CustomerLayout>
        <div className="max-w-5xl mx-auto py-12 text-center text-gray-500 text-sm">
          {error || 'No dashboard data.'}
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back{data.customer?.name ? `, ${data.customer.name}` : ''}. Here's your milk subscription overview.</p>
        </div>

        {/* Monthly Payment Banner */}
        {hasSubscription && paymentRequired && !isOverdue && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-6 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Pay your subscription for {monthName} {mp?.year}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Monthly payment due by the 7th. Amount: ₹{mp ? (mp.amountDuePaise / 100).toFixed(2) : '0'}
              </p>
              <Link
                to="/customer/wallet"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Pay Now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Overdue Payment Banner */}
        {hasSubscription && isOverdue && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-5 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Subscription overdue for {monthName} {mp?.year}
              </h3>
              <p className="text-sm text-red-800 mb-3">
                Your deliveries are paused because payment is overdue. Please pay now to resume deliveries.
              </p>
              <Link
                to="/customer/wallet"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Pay Now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Paid Confirmation */}
        {hasSubscription && isMonthPaid && mp && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-900">
              <strong>{monthName} {mp.year}</strong> subscription paid.
              {mp.paidAt && ` Paid on ${formatDateLocal(mp.paidAt, 'short')}`}
            </p>
          </div>
        )}

        {/* Next Month Advance Payment Banner */}
        {hasSubscription && data.nextMonthPreview?.isPreviewAvailable && (
          data.nextMonthPreview.walletCoversNextMonth ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-900">
                Your wallet covers <strong>{data.nextMonthPreview.nextMonthName} {data.nextMonthPreview.nextYear}</strong>. It will be auto-deducted on the 1st.
              </p>
            </div>
          ) : data.nextMonthPreview.shortfallRs > 0 ? (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-6 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Prepare for {data.nextMonthPreview.nextMonthName}: Pay ₹{data.nextMonthPreview.shortfallRs.toFixed(2)} now
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Your projected wallet won't cover next month. Pay in advance for a seamless start.
                </p>
                <Link
                  to="/customer/wallet"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Pay Advance <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : null
        )}

        {/* Pending Payment Notice */}
        {data.customer.status === 'PENDING_PAYMENT' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Complete Your Subscription</h3>
              <p className="text-sm text-gray-600 mb-3">
                Select your daily milk quantity and pay to start receiving fresh milk at your doorstep every morning between 6-8 AM.
              </p>
              <Link
                to="/customer/subscription"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Start Subscription <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {!hasSubscription && !isPendingPayment && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Start Your Subscription</h3>
              <p className="text-sm text-gray-600 mb-3">
                You don't have an active subscription yet. Subscribe now to start receiving fresh milk every morning.
              </p>
              <Link
                to="/customer/subscription"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Subscribe Now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex gap-3">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Important</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Delivery between 6-8 AM daily</li>
              <li>Cutoff for changes: 4 PM previous day</li>
              <li>Pause delivery anytime from Calendar</li>
              <li>Payment due by the <strong>7th of every month</strong></li>
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-4 grid-cols-2 gap-4 mb-8">
          {kpiData.map((kpi, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <kpi.icon className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">{kpi.label}</p>
              <div className="flex items-center gap-2">
                <p className={`${kpi.value === 'Waiting for Approval' || kpi.value === 'No Subscription' ? 'text-base' : 'text-xl'} font-semibold ${kpi.valueColor || 'text-gray-900'}`}>{kpi.value}</p>
                {kpi.badge && <Badge variant={kpi.badge as any}>{kpi.badge === 'success' ? 'Active' : kpi.badge === 'error' ? 'Inactive' : 'Paused'}</Badge>}
              </div>
              {kpi.subtext && <p className="text-xs text-gray-400 mt-0.5">{kpi.subtext}</p>}
            </Card>
          ))}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.path} className="block">
              <Card
                hover
                className="p-4 md:p-5 cursor-pointer group"
              >
                <div className="flex items-center gap-3 md:block">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 md:mb-3">
                    <action.icon className="w-4 h-4 text-green-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{action.title}</h3>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 md:hidden" />
                    </div>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center text-green-800 text-xs font-medium gap-1 mt-3">
                  View
                  <ArrowRight className="w-3 h-3" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
};

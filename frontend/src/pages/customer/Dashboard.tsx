import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { getApiUrl } from '../../config/api';
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
    status: string; // PENDING_APPROVAL, ACTIVE, etc.
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
  nextDelivery: { deliveryDate: string } | null;
  balanceCoversDays?: number;
  pauseDaysUsed: number;
  recentTransactions: { type: string; amountPaise: number; createdAt: string; description: string }[];
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
  // Always show date instead of day name
  return formatDateLocal(d, 'short');
}

function lastTopUp(recentTransactions: DashboardData['recentTransactions']): string {
  const topUp = recentTransactions.find((t) => t.type === 'WALLET_TOPUP');
  if (!topUp) return '—';
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/customer/dashboard'), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const pauseDaysUsed = data?.pauseDaysUsed ?? 0;

  // Subscription: 4 statuses based on customer status and subscription display
  const hasSubscription = !!data?.subscription;
  const customerStatus = data?.customer?.status;
  const isPendingPayment = customerStatus === 'PENDING_PAYMENT'; // New user, hasn't subscribed
  const isPendingApproval = customerStatus === 'PENDING_APPROVAL'; // Subscribed, waiting for admin
  const subDisplay = data?.subscription?.subscriptionStatusDisplay;

  // Determine subscription label based on 4-status system
  const subscriptionLabel = isPendingPayment
    ? 'Pending'
    : isPendingApproval
    ? 'Waiting for Approval'
    : hasSubscription
    ? (subDisplay === 'ACTIVE' ? 'Active' : subDisplay === 'PAUSED' ? 'Paused' : subDisplay === 'INACTIVE' ? 'Inactive' : data?.subscription?.status ?? '—')
    : 'No Subscription';

  const subscriptionBadge = isPendingPayment
    ? 'error' // Red badge for "Pending"
    : isPendingApproval
    ? undefined // No badge for "Waiting for Approval" - text label is clear enough
    : !hasSubscription
    ? 'error'
    : subDisplay === 'INACTIVE'
    ? 'error'
    : subDisplay === 'PAUSED'
    ? 'warning'
    : undefined; // Green for "Active"

  const balanceCoversDays = data?.balanceCoversDays ?? 0;
  const subscriptionSubtext = isPendingPayment
    ? 'Complete subscription'
    : isPendingApproval
    ? undefined // No subtext - "Waiting for Approval" label is clear enough
    : !hasSubscription
    ? 'Start your subscription'
    : subDisplay === 'PAUSED'
    ? 'Delivery paused'
    : (subDisplay === 'ACTIVE' && balanceCoversDays === 1 ? '1 day grace period' : undefined);

  const kpiData = [
    {
      icon: Wallet,
      label: 'Wallet Balance',
      value: data ? `₹${Number(data.customer.walletBalanceRs).toLocaleString('en-IN')}` : '—',
      subtext: data ? lastTopUp(data.recentTransactions) : '—',
      color: 'emerald',
    },
    {
      icon: CheckCircle,
      label: 'Subscription',
      value: subscriptionLabel,
      badge: subscriptionBadge,
      subtext: subscriptionSubtext,
      color: 'emerald',
    },
    {
      icon: Truck,
      label: 'Next Delivery',
      value: data?.nextDelivery ? formatDate(data.nextDelivery.deliveryDate) : '—',
      subtext: data?.nextDelivery
        ? '6:00 AM'
        : isPendingPayment
        ? 'Complete subscription first'
        : isPendingApproval
        ? 'Waiting for admin approval'
        : '—',
      color: 'blue',
    },
    {
      icon: Calendar,
      label: 'Pause Days',
      value: `${pauseDaysUsed}`,
      subtext: 'Days paused this month',
      color: 'orange',
    },
  ];

  const quickActions = [
    {
      icon: Package,
      title: 'Manage Subscription',
      description: 'Change your plan or daily quantity',
      gradient: 'from-emerald-500 to-emerald-600',
      path: '/customer/subscription',
    },
    {
      icon: Calendar,
      title: 'Pause/Block Dates',
      description: 'Manage your delivery calendar',
      gradient: 'from-blue-500 to-blue-600',
      path: '/customer/calendar',
    },
    {
      icon: CreditCard,
      title: 'Top-up Wallet',
      description: 'Add money to your wallet',
      gradient: 'from-purple-500 to-purple-600',
      path: '/customer/wallet',
    },
    {
      icon: Clock,
      title: 'View History',
      description: 'See your delivery and bottle records',
      gradient: 'from-orange-500 to-orange-600',
      path: '/customer/history',
    },
    {
      icon: HelpCircle,
      title: 'Get Support',
      description: 'Contact us or view FAQs',
      gradient: 'from-teal-500 to-teal-600',
      path: '/customer/support',
    },
  ];

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  if (error || !data) {
    return (
      <CustomerLayout>
        <div className="max-w-7xl mx-auto py-12 text-center text-gray-600">
          {error || 'No dashboard data.'}
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back{data.customer?.name ? `, ${data.customer.name}` : ''}! Here's your milk subscription overview.</p>
        </div>

        {/* Pending Payment Notice - New user hasn't subscribed yet */}
        {data.customer.status === 'PENDING_PAYMENT' && (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-8 mb-8 flex gap-4">
            <Info className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">📝 Complete Your Subscription</h3>
              <p className="text-gray-700 mb-2 text-lg">
                Welcome! You've completed your profile. Now let's set up your milk subscription.
              </p>
              <p className="text-gray-600 mb-4">
                Select your daily milk quantity and start receiving fresh milk at your doorstep every morning at 6 AM.
              </p>
              <Link
                to="/customer/subscription"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Start Subscription Now <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        )}


        {!hasSubscription && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8 flex gap-4">
            <Info className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your Subscription</h3>
              <p className="text-gray-700 mb-3">
                You don't have an active subscription yet. Subscribe now to start receiving fresh milk at your doorstep every morning!
              </p>
              <Link
                to="/customer/subscription"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
              >
                Subscribe Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 flex gap-4">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Important Information</h3>
            <ul className="list-disc pl-4 space-y-1 text-gray-700">
              <li>Delivery happens at 6 AM every day</li>
              <li>Cutoff time for changes is 5 PM previous day</li>
              <li>You can pause delivery anytime from the Calendar page</li>
              <li>Payment date is the <strong>5th of every month</strong> — full month charge in ₹</li>
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-4 grid-cols-1 gap-6 mb-8">
          {kpiData.map((kpi, index) => (
            <Card key={index} className="p-6 border-l-4 border-emerald-500">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 bg-${kpi.color}-100 rounded-xl flex items-center justify-center`}>
                  <kpi.icon className={`w-6 h-6 text-${kpi.color}-600`} />
                </div>
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">{kpi.label}</p>
              <div className="flex items-center gap-2">
                <p className={`${kpi.value === 'Waiting for Approval' ? 'text-xl' : 'text-3xl'} font-bold text-gray-900`}>{kpi.value}</p>
                {kpi.badge && <Badge variant={kpi.badge as any}>{kpi.value}</Badge>}
              </div>
              {kpi.subtext && <p className="text-xs text-gray-500 mt-1">{kpi.subtext}</p>}
            </Card>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-3 grid-cols-1 gap-6">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.path} className="block">
              <Card
                hover
                className="p-8 border-2 border-gray-200 hover:border-emerald-200 cursor-pointer group"
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <action.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-gray-600 mb-4">{action.description}</p>
                <div className="flex items-center text-emerald-600 font-semibold group-hover:gap-3 gap-2 transition-all">
                  View
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
};

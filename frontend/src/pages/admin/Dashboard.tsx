import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Droplet, Package, IndianRupee, Clock } from 'lucide-react';

type DashboardData = {
  todayLiters: number;
  todayLitersChange: number;
  bottlesOut: number;
  bottlesCollected: number;
  todayRevenueRs: string;
  todayRevenueChange: number;
  pendingApprovals: number;
  revenueTrend: number[];
  recentActivities: { text: string; time: string; type: string }[];
};

const activityColors: Record<string, string> = {
  registration: 'blue',
  approval: 'green',
  payment: 'emerald',
  bottle: 'orange',
  delivery: 'purple',
};

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto py-12 text-center text-red-600">{error}</div>
      </AdminLayout>
    );
  }

  const d = data!;
  const kpiData = [
    {
      icon: Droplet,
      label: "Today's Liters",
      value: `${d.todayLiters}L`,
      subtext: `+${d.todayLitersChange}% from yesterday`,
      color: 'blue',
    },
    {
      icon: Package,
      label: 'Bottles Out',
      value: String(d.bottlesOut),
      subtext: `${d.bottlesCollected} collected`,
      color: 'orange',
    },
    {
      icon: IndianRupee,
      label: "Today's Revenue",
      value: `₹${Number(d.todayRevenueRs).toLocaleString('en-IN')}`,
      subtext: `+${d.todayRevenueChange}% from yesterday`,
      color: 'emerald',
    },
    {
      icon: Clock,
      label: 'Pending Approvals',
      value: String(d.pendingApprovals),
      subtext: 'New subscriptions',
      color: 'red',
    },
  ];

  const maxRevenue = Math.max(...d.revenueTrend, 1);
  const dayLabels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Overview of Maa Ilay operations (data from database)</p>
        </div>

        <div className="grid md:grid-cols-4 grid-cols-1 gap-6 mb-8">
          {kpiData.map((kpi, index) => (
            <Card key={index} className={`p-6 border-l-4 border-${kpi.color}-500`}>
              <div className={`w-12 h-12 bg-${kpi.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                <kpi.icon className={`w-6 h-6 text-${kpi.color}-600`} />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">{kpi.label}</p>
              <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-1">{kpi.subtext}</p>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Revenue Trend (7 days)</h2>
            <div className="h-48 flex items-end gap-2 px-2">
              {d.revenueTrend.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-emerald-500 rounded-t transition-all"
                    style={{
                      height: val ? `${Math.max(4, (val / maxRevenue) * 160)}px` : '4px',
                    }}
                    title={`₹${val.toLocaleString('en-IN')}`}
                  />
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {dayLabels[i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-sm text-gray-500">
              <span>₹0</span>
              <span>₹{maxRevenue.toLocaleString('en-IN')}</span>
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activities</h2>
            <div className="space-y-4">
              {d.recentActivities.map((activity, index) => (
                <div key={index} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                  <div
                    className={`w-10 h-10 bg-${activityColors[activity.type] || 'gray'}-100 rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <div
                      className={`w-3 h-3 bg-${activityColors[activity.type] || 'gray'}-500 rounded-full`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">{activity.text}</p>
                    <p className="text-sm text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

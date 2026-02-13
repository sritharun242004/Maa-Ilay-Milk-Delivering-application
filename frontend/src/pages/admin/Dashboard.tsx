import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Droplet, Package, IndianRupee, Clock } from 'lucide-react';
import { getApiUrl } from '../../config/api';

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
  payment: 'green',
  bottle: 'orange',
  delivery: 'purple',
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(() => {
    try {
      const cached = sessionStorage.getItem('admin_dashboard');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/admin/dashboard'), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then((d) => {
        setData(d);
        try { sessionStorage.setItem('admin_dashboard', JSON.stringify(d)); } catch {}
      })
      .catch(() => { if (!data) setError('Could not load dashboard'); })
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
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
      subtext: `${d.todayLitersChange >= 0 ? '+' : ''}${d.todayLitersChange}% from yesterday`,
      subtextColor: d.todayLitersChange >= 0 ? 'text-green-800' : 'text-red-600',
      color: 'blue',
      onClick: () => navigate('/admin/today-deliveries'),
      clickable: true,
    },
    {
      icon: Package,
      label: 'Bottles Out',
      value: String(d.bottlesOut),
      subtext: `${d.bottlesCollected} collected today`,
      color: 'orange',
      onClick: () => navigate('/admin/bottles-out'),
      clickable: true,
    },
    {
      icon: IndianRupee,
      label: "Today's Revenue",
      value: `₹${Number(d.todayRevenueRs).toLocaleString('en-IN')}`,
      subtext: `${d.todayRevenueChange >= 0 ? '+' : ''}${d.todayRevenueChange}% from yesterday`,
      subtextColor: d.todayRevenueChange >= 0 ? 'text-green-800' : 'text-red-600',
      color: 'green',
      clickable: false,
    },
    {
      icon: Clock,
      label: 'Pending Approvals',
      value: String(d.pendingApprovals),
      subtext: 'New subscriptions',
      color: 'red',
      clickable: false,
    },
  ];

  const maxRevenue = Math.max(...d.revenueTrend, 1);
  const dayLabels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Overview of Maa Ilay operations (data from database)</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {kpiData.map((kpi, index) => (
            <Card
              key={index}
              className={`p-6 border-l-4 border-${kpi.color}-500 ${
                kpi.clickable ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''
              }`}
              onClick={kpi.clickable ? kpi.onClick : undefined}
            >
              <div className={`w-12 h-12 bg-${kpi.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                <kpi.icon className={`w-6 h-6 text-${kpi.color}-600`} />
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">{kpi.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{kpi.value}</p>
              <p className={`text-xs mt-1 font-medium ${kpi.subtextColor || 'text-gray-500'}`}>{kpi.subtext}</p>
              {kpi.clickable && (
                <p className="text-xs text-gray-400 mt-2 italic">Click to view details</p>
              )}
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <Card className="p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Revenue Trend (7 days)</h2>
            <div className="h-48 flex items-end gap-1 sm:gap-2 px-2">
              {d.revenueTrend.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-green-500 rounded-t transition-all hover:bg-green-800 cursor-pointer relative"
                    style={{
                      height: val ? `${Math.max(4, (val / maxRevenue) * 160)}px` : '4px',
                    }}
                  >
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      ₹{val.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-500 truncate w-full text-center">
                    {dayLabels[i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs sm:text-sm text-gray-500">
              <span>₹0</span>
              <span>₹{maxRevenue.toLocaleString('en-IN')}</span>
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Recent Activities</h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {d.recentActivities.map((activity, index) => (
                <div key={index} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                  <div
                    className={`w-10 h-10 bg-${activityColors[activity.type] || 'gray'}-100 rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <div
                      className={`w-3 h-3 bg-${activityColors[activity.type] || 'gray'}-500 rounded-full`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{activity.text}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">{activity.time}</p>
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

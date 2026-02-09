import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { ArrowLeft, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type TodayDelivery = {
  customerName: string;
  liters: number;
  deliveryPersonName: string;
  status: string;
  deliveryDate: string;
};

// Utility functions
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(d);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const TodayDeliveries: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateString(new Date()));
  const [deliveries, setDeliveries] = useState<TodayDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/deliveries-by-date?date=${selectedDate}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setDeliveries(data.deliveries || []))
      .catch((err) => console.error('Failed to fetch deliveries:', err))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Date navigation
  const handleDateChange = useCallback((days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateString(d));
  }, [selectedDate]);

  const totalLiters = deliveries.reduce((sum, d) => sum + d.liters, 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 text-green-800 hover:text-green-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        {/* Header Card with Date Navigation */}
        <Card className="mb-6 bg-gray-900 text-white overflow-hidden">
          <div className="p-6">
            {/* Date Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => handleDateChange(-1)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="text-center">
                <p className="text-blue-100 text-sm mb-1">Deliveries for</p>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {formatDateDisplay(selectedDate)}
                </h1>
                <p className="text-blue-100 text-sm mt-1">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>

              <button
                onClick={() => handleDateChange(1)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Next day"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-blue-100 text-sm">Total Deliveries</p>
                <p className="text-3xl font-bold">{deliveries.length}</p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Total Liters</p>
                <p className="text-3xl font-bold">{totalLiters.toFixed(1)}L</p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Status</p>
                <p className="text-xl font-bold">Delivered</p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Delivery Time</p>
                <p className="text-xl font-bold">6:00 AM</p>
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deliveries.length === 0 ? (
          <Card className="p-12 text-center">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No deliveries for this date</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 uppercase w-20">S.No</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Customer Name</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Date</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Quantity</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Delivered By</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                    >
                      <td className="py-4 px-6 text-gray-600 font-medium">{index + 1}</td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-900">{delivery.customerName}</span>
                      </td>
                      <td className="py-4 px-6 text-center text-gray-600">
                        {new Date(selectedDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-4 py-2 bg-green-100 text-green-800 font-bold rounded-full text-lg">
                          {delivery.liters}L
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-gray-900">{delivery.deliveryPersonName}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full uppercase">
                          {delivery.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

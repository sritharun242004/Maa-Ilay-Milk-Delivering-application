import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/Card';
import { ArrowLeft, Package, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../../config/api';

type BottleBalance = {
  customerName: string;
  largeBottles: number;
  smallBottles: number;
  totalBottles: number;
};

export const BottlesOut: React.FC = () => {
  const navigate = useNavigate();
  const [bottlesData, setBottlesData] = useState<BottleBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/admin/bottles-out'), { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setBottlesData(data.bottles || []))
      .catch((err) => console.error('Failed to fetch bottles:', err))
      .finally(() => setLoading(false));
  }, []);

  const totalBottles = bottlesData.reduce((sum, b) => sum + b.totalBottles, 0);
  const totalLarge = bottlesData.reduce((sum, b) => sum + b.largeBottles, 0);
  const totalSmall = bottlesData.reduce((sum, b) => sum + b.smallBottles, 0);

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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Bottles Out with Customers</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Total bottles in circulation: {totalBottles} ({totalLarge} × 1L + {totalSmall} × 500ml)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 font-medium mb-1">Total Bottles</p>
            <p className="text-3xl font-bold text-gray-900">{totalBottles}</p>
          </Card>
          <Card className="p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium mb-1">1L Bottles</p>
            <p className="text-3xl font-bold text-gray-900">{totalLarge}</p>
          </Card>
          <Card className="p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 font-medium mb-1">500ml Bottles</p>
            <p className="text-3xl font-bold text-gray-900">{totalSmall}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bottlesData.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No bottles out with customers</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Customer</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">1L Bottles</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">500ml Bottles</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bottlesData.map((customer, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 hover:bg-orange-50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{customer.customerName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 font-medium rounded-full">
                          {customer.largeBottles}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 font-medium rounded-full">
                          {customer.smallBottles}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 font-bold rounded-full">
                          {customer.totalBottles}
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

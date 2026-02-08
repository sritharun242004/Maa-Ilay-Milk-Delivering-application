import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatDateLocal } from '../../lib/date';
import { Package, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../../config/api';

type DeliveryRow = {
  id: string;
  date: string;
  day: string;
  quantity: string;
  status: 'delivered' | 'not-delivered' | 'paused' | 'pending';
  person: string;
  remarks: string;
};

type BottleRow = {
  id: string;
  date: string;
  type: 'issued' | 'collected' | 'penalty';
  bottles1L: number;
  bottles500ml: number;
  balance: number;
};

type BottlesData = {
  totalIssued: number;
  totalCollected: number;
  withCustomer: number;
  entries: BottleRow[];
};

export const History: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'delivery' | 'bottles' | 'penalties'>('delivery');
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryRow[]>([]);
  const [bottleData, setBottleData] = useState<BottlesData | null>(null);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [loadingBottles, setLoadingBottles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'delivery') {
      setLoadingDelivery(true);
      setError(null);
      fetch(getApiUrl('/api/customer/history/deliveries'), { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load delivery history');
          return res.json();
        })
        .then((data) => setDeliveryHistory(data.deliveries ?? []))
        .catch(() => setError('Could not load delivery history'))
        .finally(() => setLoadingDelivery(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'bottles') {
      setLoadingBottles(true);
      setError(null);
      fetch(getApiUrl('/api/customer/history/bottles'), { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load bottle ledger');
          return res.json();
        })
        .then(setBottleData)
        .catch(() => setError('Could not load bottle ledger'))
        .finally(() => setLoadingBottles(false));
    }
  }, [activeTab]);

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">History</h1>
          <p className="text-gray-600">View your delivery and bottle records</p>
        </div>

        <Card className="p-2 mb-8">
          <div className="flex gap-2">
            {[
              { id: 'delivery', label: 'Delivery History' },
              { id: 'bottles', label: 'Bottle Ledger' },
              { id: 'penalties', label: 'Penalties' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${activeTab === tab.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-transparent text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>

        {activeTab === 'delivery' && (
          <Card className="p-6">
            {loadingDelivery ? (
              <p className="text-gray-500 py-8 text-center">Loading delivery history...</p>
            ) : error ? (
              <p className="text-red-600 py-4">{error}</p>
            ) : deliveryHistory.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No delivery records yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Day</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Quantity</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Delivery Person</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryHistory.map((delivery) => (
                      <tr key={delivery.id} className="border-b border-gray-200">
                        <td className="py-4 px-4">{formatDateLocal(delivery.date, 'short')}</td>
                        <td className="py-4 px-4">{delivery.day}</td>
                        <td className="py-4 px-4 font-semibold">{delivery.quantity}</td>
                        <td className="py-4 px-4">
                          {delivery.status === 'delivered' ? (
                            <Badge variant="success">Delivered</Badge>
                          ) : delivery.status === 'paused' ? (
                            <Badge className="bg-orange-100 text-orange-700">Paused</Badge>
                          ) : delivery.status === 'pending' ? (
                            <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
                          ) : (
                            <Badge variant="error">Not Delivered</Badge>
                          )}
                        </td>
                        <td className="py-4 px-4">{delivery.person}</td>
                        <td className="py-4 px-4 text-gray-600">{delivery.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'bottles' && (
          <>
            {loadingBottles ? (
              <p className="text-gray-500 py-8 text-center">Loading bottle ledger...</p>
            ) : error ? (
              <p className="text-red-600 py-4">{error}</p>
            ) : !bottleData ? (
              <p className="text-gray-500 py-8 text-center">No bottle data</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <p className="text-sm opacity-90 mb-2">Total Issued</p>
                    <p className="text-4xl font-bold">{bottleData.totalIssued}</p>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <p className="text-sm opacity-90 mb-2">Total Collected</p>
                    <p className="text-4xl font-bold">{bottleData.totalCollected}</p>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <p className="text-sm opacity-90 mb-2">With Customer</p>
                    <p className="text-4xl font-bold">{bottleData.withCustomer}</p>
                  </Card>
                </div>

                <Card className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Transaction Type</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">1L Bottles</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">500ml Bottles</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bottleData.entries.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500">No bottle ledger entries yet</td>
                          </tr>
                        ) : (
                          bottleData.entries.map((ledger) => (
                            <tr
                              key={ledger.id}
                              className={`border-b border-gray-200 ${ledger.type === 'issued' ? 'bg-red-50' : ledger.type === 'collected' ? 'bg-green-50' : ''
                                }`}
                            >
                              <td className="py-4 px-4">{formatDateLocal(ledger.date, 'short')}</td>
                              <td className="py-4 px-4">
                                <Badge variant={ledger.type === 'issued' ? 'warning' : 'success'}>
                                  {ledger.type === 'issued' ? 'Issued' : ledger.type === 'collected' ? 'Collected' : 'Penalty'}
                                </Badge>
                              </td>
                              <td className="py-4 px-4 text-center font-semibold">{ledger.bottles1L}</td>
                              <td className="py-4 px-4 text-center font-semibold">{ledger.bottles500ml}</td>
                              <td className="py-4 px-4 text-center font-bold text-orange-600">{ledger.balance}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {activeTab === 'penalties' && (
          <Card className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No penalties!</h3>
            <p className="text-gray-600">Keep up the good work!</p>
          </Card>
        )}
      </div>
    </CustomerLayout>
  );
};

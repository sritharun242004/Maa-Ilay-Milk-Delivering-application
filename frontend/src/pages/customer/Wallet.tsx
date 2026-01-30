import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { formatDateLocal } from '../../lib/date';

type WalletData = {
  balancePaise: number;
  balanceRs: string;
  lastTransactionAt: string | null;
  transactions: {
    id: string;
    type: string;
    amountPaise: number;
    amountRs: string;
    balanceAfterPaise: number;
    balanceAfterRs: string;
    description: string;
    createdAt: string;
  }[];
};

export const Wallet: React.FC = () => {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customer/wallet', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load wallet');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[40vh]">
          <p className="text-gray-500">Loading wallet...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (error || !data) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-red-600">{error ?? 'Could not load wallet'}</p>
        </div>
      </CustomerLayout>
    );
  }

  const isCredit = (type: string) => type === 'WALLET_TOPUP' || (typeof type === 'string' && type.toLowerCase().includes('top') || type.toLowerCase().includes('credit'));

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Wallet</h1>
          <p className="text-gray-600">View your balance and transaction history</p>
        </div>

        <div className="relative bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-3xl p-10 shadow-2xl mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <p className="text-emerald-100 mb-2">Available Balance</p>
            <p className="text-6xl font-bold">₹{Number(data.balanceRs).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Transaction History</h2>

          {data.transactions.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Type</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-200">
                      <td className="py-4 px-4">{formatDateLocal(txn.createdAt, 'short')}</td>
                      <td className="py-4 px-4">{txn.description}</td>
                      <td className="py-4 px-4">
                        <span className={isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}>
                          {txn.type === 'WALLET_TOPUP' ? 'Credit' : txn.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-right font-semibold ${isCredit(txn.type) ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.amountPaise >= 0 ? '+' : ''}₹{txn.amountRs}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold">₹{txn.balanceAfterRs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};

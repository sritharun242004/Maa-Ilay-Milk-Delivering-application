import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { fetchWithCsrf } from '../../utils/csrf';

type PaymentStatus = 'verifying' | 'success' | 'failed';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Get order_id from URL query params
      const orderId = searchParams.get('order_id');

      // Debug logging
      console.log('Current URL:', window.location.href);
      console.log('Search params:', Object.fromEntries(searchParams.entries()));
      console.log('Order ID from URL:', orderId);

      if (!orderId) {
        setStatus('failed');
        setMessage('Invalid payment session. No order ID found. URL: ' + window.location.href);
        return;
      }

      // Verify payment with backend
      const response = await fetchWithCsrf('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.verified) {
        setStatus('success');
        setAmount(data.amount || 0);
        setWalletBalance(data.walletBalance || 0);
        setMessage(`₹${data.amount} has been successfully added to your wallet!`);
      } else {
        setStatus('failed');
        setMessage(data.error || 'Payment verification failed. Please contact support if amount was deducted.');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      setMessage('Failed to verify payment. Please contact support.');
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-12 text-center">
          {status === 'verifying' && (
            <>
              <Loader className="w-16 h-16 text-green-500 mx-auto mb-6 animate-spin" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Verifying Payment</h1>
              <p className="text-gray-600">Please wait while we confirm your payment...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
              <p className="text-lg text-gray-700 mb-6">{message}</p>

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-8">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Amount Added</p>
                    <p className="text-2xl font-bold text-green-800">₹{amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">New Balance</p>
                    <p className="text-2xl font-bold text-gray-900">₹{walletBalance.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/customer/wallet')}>
                  View Wallet
                </Button>
                <Button variant="secondary" onClick={() => navigate('/customer/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Failed</h1>
              <p className="text-lg text-gray-700 mb-8">{message}</p>

              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
                <p className="text-sm text-red-800">
                  If you have been charged but your wallet was not credited, please contact our support team
                  with your order details.
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/customer/wallet')}>
                  Try Again
                </Button>
                <Button variant="secondary" onClick={() => navigate('/customer/support')}>
                  Contact Support
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};

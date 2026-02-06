import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CheckCircle, XCircle, ArrowRight, Minus, Plus, AlertCircle } from 'lucide-react';
import { deliveryKeys } from '../../hooks/useDeliveryData';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  deliveryNotes: string | null;
  status: string;
  subscription: { dailyQuantityMl: number; status: string } | null;
}

interface DeliveryData {
  id: string;
  deliveryDate: string;
  quantityMl: number;
  largeBottles: number;
  smallBottles: number;
  status: string;
  deliveryNotes: string | null;
  largeBottlesCollected: number;
  smallBottlesCollected: number;
}

interface ActionPageData {
  customer: CustomerData;
  delivery: DeliveryData | null;
  bottleBalance: { large: number; small: number };
  date?: string;
}

function quantityLabel(quantityMl: number): string {
  if (quantityMl >= 1000) return `${quantityMl / 1000}L`;
  return `${quantityMl}ml`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CustomerAction: React.FC = () => {
  const { id: customerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const dateFromState = (location.state as { date?: string } | null)?.date;
  const selectedDate = dateFromState || toDateString(new Date());

  const [submitting, setSubmitting] = useState(false);
  const [largeCollected, setLargeCollected] = useState(0);
  const [smallCollected, setSmallCollected] = useState(0);
  const [deliveryStatus, setDeliveryStatus] = useState<'DELIVERED' | 'NOT_DELIVERED' | null>(null);
  const [reason, setReason] = useState('Customer not home');
  const [remarks, setRemarks] = useState('');

  // Fetch customer data - ALWAYS from database, no cache
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['delivery-action', customerId, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/delivery/customer/${customerId}?date=${selectedDate}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Customer not found');
      return res.json() as Promise<ActionPageData>;
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !!customerId,
  });

  const error = queryError ? 'Customer not found' : null;

  // Update form state when data loads from database
  useEffect(() => {
    if (data?.delivery) {
      const dv = data.delivery;
      if (dv.status === 'DELIVERED' || dv.status === 'NOT_DELIVERED') {
        setDeliveryStatus(dv.status as any);
      }
      setLargeCollected(typeof dv.largeBottlesCollected === 'number' ? dv.largeBottlesCollected : 0);
      setSmallCollected(typeof dv.smallBottlesCollected === 'number' ? dv.smallBottlesCollected : 0);
      setRemarks(typeof dv.deliveryNotes === 'string' ? dv.deliveryNotes : '');
    }
  }, [data]);

  const handleSubmit = async () => {
    if (!data?.delivery || !deliveryStatus) {
      alert('Please select delivery status (Delivered or Not Delivered).');
      return;
    }

    setSubmitting(true);
    try {
      const notes = deliveryStatus === 'NOT_DELIVERED' ? `${reason}. ${remarks}`.trim() : remarks;
      const res = await fetchWithCsrf(`/api/delivery/${data.delivery.id}/mark`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: deliveryStatus,
          deliveryNotes: notes || undefined,
          largeBottlesCollected: deliveryStatus === 'DELIVERED' ? largeCollected : undefined,
          smallBottlesCollected: deliveryStatus === 'DELIVERED' ? smallCollected : undefined,
        }),
      });

      // Handle CSRF errors by clearing cache and retrying once
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        if (res.status === 403 && err.error?.includes('CSRF')) {
          clearCsrfToken();
          // Retry with fresh token
          const retryRes = await fetchWithCsrf(`/api/delivery/${data.delivery.id}/mark`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: deliveryStatus,
              deliveryNotes: notes || undefined,
              largeBottlesCollected: deliveryStatus === 'DELIVERED' ? largeCollected : undefined,
              smallBottlesCollected: deliveryStatus === 'DELIVERED' ? smallCollected : undefined,
            }),
          });

          if (!retryRes.ok) {
            const retryErr = await retryRes.json().catch(() => ({}));
            alert(retryErr.error || 'Failed to update delivery');
            return;
          }
        } else {
          alert(err.error || 'Failed to update delivery');
          return;
        }
      }

      // Clear ALL caches to force fresh data
      queryClient.removeQueries({ queryKey: ['deliveries'] });
      queryClient.removeQueries({ queryKey: ['delivery'] });
      queryClient.removeQueries({ queryKey: ['delivery-action'] });

      // Navigate back to today's page WITH the date
      navigate('/delivery/today', {
        replace: true,
        state: { date: selectedDate, forceRefresh: Date.now() }
      });

      // Force refetch after navigation completes for the specific date
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: deliveryKeys.todayDeliveries(selectedDate),
          type: 'active'
        });
      }, 150);
    } catch (error) {
      console.error('Failed to update delivery:', error);
      alert('Failed to update delivery');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DeliveryLayout>
        <div className="max-w-4xl mx-auto">
          <div className="h-10 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="space-y-4 mb-8">
            <div className="h-6 bg-gray-100 rounded w-full max-w-md" />
            <div className="h-6 bg-gray-100 rounded w-full max-w-sm" />
            <div className="h-6 bg-gray-100 rounded w-3/4" />
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading customer...</span>
          </div>
        </div>
      </DeliveryLayout>
    );
  }

  if (error || !data) {
    return (
      <DeliveryLayout>
        <div className="max-w-4xl mx-auto py-8">
          <p className="text-red-600">{error || 'Customer not found'}</p>
          <Button variant="secondary" onClick={() => navigate('/delivery/today')} className="mt-4">
            Back to Today
          </Button>
        </div>
      </DeliveryLayout>
    );
  }

  const { customer, delivery, bottleBalance } = data;
  const address = [customer.addressLine1, customer.addressLine2, customer.landmark].filter(Boolean).join(', ');
  const hasDelivery = !!delivery;
  const isAlreadyCompleted = delivery && (delivery.status === 'DELIVERED' || delivery.status === 'NOT_DELIVERED');
  const planQty = delivery
    ? delivery.quantityMl
    : customer.subscription?.dailyQuantityMl ?? 0;

  return (
    <DeliveryLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Delivery Action</h1>

        {/* Already Completed Banner */}
        {isAlreadyCompleted && (
          <Card className="p-6 mb-8 border-2 border-blue-200 bg-blue-50">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">
                  ✓ Already Marked as {delivery.status === 'DELIVERED' ? 'Delivered' : 'Not Delivered'}
                </h3>
                <p className="text-blue-800 mb-3">
                  This delivery was completed on {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleString('en-IN') : 'N/A'}.
                  The data below is loaded from the database.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/50 p-3 rounded-lg">
                    <p className="text-blue-600 font-medium mb-1">Bottles Collected</p>
                    <p className="text-blue-900 font-bold">
                      {delivery.largeBottlesCollected || 0}×1L, {delivery.smallBottlesCollected || 0}×500ml
                    </p>
                  </div>
                  {delivery.deliveryNotes && (
                    <div className="bg-white/50 p-3 rounded-lg">
                      <p className="text-blue-600 font-medium mb-1">Remarks</p>
                      <p className="text-blue-900">{delivery.deliveryNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Name</p>
              <p className="text-lg font-semibold">{customer.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Phone</p>
              <p className="text-lg font-semibold">+91 {customer.phone}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 mb-1">Address</p>
              <p className="text-lg font-semibold">{address || customer.addressLine1}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Plan</p>
              <p className="text-lg font-semibold">{quantityLabel(planQty)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge variant="success">{customer.subscription?.status ?? customer.status}</Badge>
            </div>
          </div>
          {customer.deliveryNotes && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Special Instructions</p>
              <p className="text-gray-900 font-medium">{customer.deliveryNotes}</p>
            </div>
          )}
        </Card>

        {!hasDelivery && (
          <Card className="p-8 mb-8 border-amber-200 bg-amber-50">
            <p className="text-amber-800 font-medium">No delivery scheduled for this date.</p>
            <p className="text-amber-700 text-sm mt-2">You can view customer info above. To mark delivery status, open a date that has a scheduled delivery for this customer.</p>
            <Button variant="secondary" onClick={() => navigate('/delivery/today')} className="mt-4">
              Back to Today&apos;s Deliveries
            </Button>
          </Card>
        )}

        {hasDelivery && (
          <>
            <Card variant="gradient" className="p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Mark Delivery Status</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setDeliveryStatus('DELIVERED')}
                  className={`py-6 rounded-xl font-bold text-lg flex flex-col items-center gap-3 transition-all ${deliveryStatus === 'DELIVERED'
                    ? 'bg-emerald-500 text-white scale-105'
                    : 'bg-white border-2 border-gray-300 hover:border-emerald-500'
                    }`}
                >
                  <CheckCircle className="w-8 h-8" />
                  Delivered
                </button>
                <button
                  onClick={() => setDeliveryStatus('NOT_DELIVERED')}
                  className={`py-6 rounded-xl font-bold text-lg flex flex-col items-center gap-3 transition-all ${deliveryStatus === 'NOT_DELIVERED'
                    ? 'bg-red-500 text-white scale-105'
                    : 'bg-white border-2 border-gray-300 hover:border-red-500'
                    }`}
                >
                  <XCircle className="w-8 h-8" />
                  Not Delivered
                </button>
              </div>

              {deliveryStatus === 'NOT_DELIVERED' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg outline-none"
                  >
                    <option>Customer not home</option>
                    <option>Customer on leave</option>
                    <option>Address issue</option>
                    <option>Other</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any remarks..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg outline-none resize-none"
                />
              </div>
            </Card>

            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Bottle Collection {hasDelivery && `(${data.date || 'this date'})`}</h2>
              <div className="p-4 bg-blue-50 rounded-lg mb-6">
                <p className="text-sm text-gray-600">Customer currently has:</p>
                <p className="text-2xl font-bold text-blue-600">
                  {bottleBalance.large} × 1L, {bottleBalance.small} × 500ml
                </p>
              </div>

              <p className="text-lg font-semibold text-gray-900 mb-2">1L bottles collected</p>
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setLargeCollected(Math.max(0, largeCollected - 1))}
                  className="w-12 h-12 bg-gray-200 rounded-xl hover:bg-gray-300 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-2xl font-bold text-emerald-600 w-8 text-center">{largeCollected}</span>
                <button
                  onClick={() => setLargeCollected(largeCollected + 1)}
                  className="w-12 h-12 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">500ml bottles collected</p>
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setSmallCollected(Math.max(0, smallCollected - 1))}
                  className="w-12 h-12 bg-gray-200 rounded-xl hover:bg-gray-300 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-2xl font-bold text-emerald-600 w-8 text-center">{smallCollected}</span>
                <button
                  onClick={() => setSmallCollected(smallCollected + 1)}
                  className="w-12 h-12 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </Card>

            <div className="flex gap-4">
              <Button
                icon={ArrowRight}
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? 'Saving...' : isAlreadyCompleted ? 'Update & Go Back' : 'Submit & Go Back'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/delivery/today')} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </DeliveryLayout>
  );
};

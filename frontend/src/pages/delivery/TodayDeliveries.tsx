import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DeliveryListSkeleton } from '../../components/ui/Skeleton';
import { ChevronLeft, ChevronRight, Package, CheckCircle, Clock, Eye } from 'lucide-react';
import { useTodayDeliveries, usePrefetchCustomer } from '../../hooks/useDeliveryData';
import { getApiUrl } from '../../config/api';

type DeliveryStatus = 'SCHEDULED' | 'DELIVERED' | 'NOT_DELIVERED' | 'PAUSED' | 'BLOCKED' | 'HOLIDAY';

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
}

interface DeliveryRow {
  id: string;
  customerId: string;
  deliveryDate: string;
  quantityMl: number;
  largeBottles: number;
  smallBottles: number;
  status: DeliveryStatus;
  largeBottlesCollected?: number;
  smallBottlesCollected?: number;
  customer: CustomerInfo;
}

// Utility functions
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
  const location = useLocation();

  // Check if date is passed from navigation state (e.g., after marking delivery)
  const dateFromState = (location.state as any)?.date;
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return dateFromState || toDateString(new Date());
  });

  // Update selected date when navigation state changes
  useEffect(() => {
    if (dateFromState && dateFromState !== selectedDate) {
      setSelectedDate(dateFromState);
    }
  }, [dateFromState]);

  // Fetch data
  const { data: today, isLoading } = useTodayDeliveries(selectedDate);
  const prefetchCustomer = usePrefetchCustomer();

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ['delivery', 'profile'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/delivery/me'), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const deliveries = today?.deliveries ?? [];

  // Separate deliveries by status
  const scheduledDeliveries = deliveries.filter((d: DeliveryRow) => d.status === 'SCHEDULED');
  const completedDeliveries = deliveries.filter((d: DeliveryRow) =>
    d.status === 'DELIVERED' || d.status === 'NOT_DELIVERED'
  );

  // Date navigation
  const handleDateChange = useCallback((days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateString(d));
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(toDateString(new Date()));
  }, []);

  // Navigate to customer action page
  const handleViewCustomer = useCallback((customerId: string) => {
    const currentIndex = deliveries.findIndex((d: DeliveryRow) => d.customerId === customerId);
    const remainingQueue = deliveries
      .slice(currentIndex + 1)
      .filter((d: DeliveryRow) => d.status === 'SCHEDULED')
      .map((d: DeliveryRow) => d.customerId);

    navigate(`/delivery/customer/${customerId}`, {
      state: {
        date: selectedDate,
        nextCustomerId: remainingQueue[0],
        remainingQueue: remainingQueue.slice(1)
      }
    });
  }, [navigate, selectedDate, deliveries]);

  if (isLoading || !profile) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="h-32 bg-gray-200 rounded-2xl animate-pulse mb-6" />
          <DeliveryListSkeleton count={6} />
        </div>
      </DeliveryLayout>
    );
  }

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header Card with Date Navigation */}
        <div className="mb-6 bg-green-800 text-white overflow-hidden rounded-lg shadow-sm">
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
                <p className="text-green-200 text-sm mb-1">Deliveries for</p>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {formatDateDisplay(selectedDate)}
                </h1>
                <p className="text-green-200 text-sm mt-1">
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

            {/* Quick Today Button */}
            {selectedDate !== toDateString(new Date()) && (
              <div className="text-center mb-6">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Jump to Today
                </button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" />
                  <p className="text-green-200 text-xs">Total</p>
                </div>
                <p className="text-3xl font-bold">{today?.total ?? 0}</p>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-green-200 text-xs">Completed</p>
                </div>
                <p className="text-3xl font-bold">{today?.completed ?? 0}</p>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  <p className="text-green-200 text-xs">Pending</p>
                </div>
                <p className="text-3xl font-bold">{today?.pending ?? 0}</p>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-200 text-xs mb-1">Liters to Load</p>
                <p className="text-3xl font-bold">{today?.totalLiters ?? 0}L</p>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-200 text-xs mb-1">Bottles</p>
                <p className="text-xl font-bold">
                  {today?.total1LBottles ?? 0}×1L, {today?.total500mlBottles ?? 0}×500ml
                </p>
              </div>
            </div>

            {/* Delivery Person Info */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-green-200 text-sm">Delivery Person</p>
              <p className="text-xl font-semibold">{profile.name}</p>
              <p className="text-green-200">+91 {profile.phone}</p>
            </div>
          </div>
        </div>

        {deliveries.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500 mb-2">No deliveries scheduled</p>
            <p className="text-gray-400">No deliveries found for this date</p>
          </Card>
        ) : (
          <>
            {/* Pending Deliveries Section */}
            <Card className="mb-6">
              <div className="p-4 bg-amber-50 border-b border-amber-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Pending Deliveries ({scheduledDeliveries.length})
                </h2>
                {scheduledDeliveries.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">Click on any customer to mark delivery status</p>
                )}
              </div>
              {scheduledDeliveries.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {scheduledDeliveries.map((delivery: DeliveryRow, index: number) => (
                    <DeliveryCard
                      key={delivery.id}
                      delivery={delivery}
                      index={index}
                      onView={handleViewCustomer}
                      onPrefetch={prefetchCustomer}
                      selectedDate={selectedDate}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400">
                  All deliveries completed
                </div>
              )}
            </Card>

            {/* Completed Deliveries Section */}
            <Card className="mb-6">
              <div className="p-4 bg-green-50 border-b border-green-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-800" />
                  Completed Deliveries ({completedDeliveries.length})
                </h2>
              </div>
              {completedDeliveries.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {completedDeliveries.map((delivery: DeliveryRow, index: number) => (
                    <DeliveryCard
                      key={delivery.id}
                      delivery={delivery}
                      index={scheduledDeliveries.length + index}
                      onView={handleViewCustomer}
                      onPrefetch={prefetchCustomer}
                      selectedDate={selectedDate}
                      isCompleted
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400">
                  No deliveries completed yet
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DeliveryLayout>
  );
};

// Delivery Card Component
interface DeliveryCardProps {
  delivery: DeliveryRow;
  index: number;
  onView: (customerId: string) => void;
  onPrefetch: (customerId: string, date: string) => void;
  selectedDate: string;
  isCompleted?: boolean;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({
  delivery,
  index,
  onView,
  onPrefetch,
  selectedDate,
  isCompleted = false
}) => {
  const { customer } = delivery;
  const address = [customer.addressLine1, customer.addressLine2, customer.landmark]
    .filter(Boolean)
    .join(', ');

  const bottlesCollected = delivery.largeBottlesCollected || delivery.smallBottlesCollected
    ? `${delivery.largeBottlesCollected || 0}×1L, ${delivery.smallBottlesCollected || 0}×500ml`
    : '–';

  return (
    <div
      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors delivery-card-touch ${isCompleted ? 'opacity-75' : ''}`}
      onClick={() => onView(customer.id)}
      onMouseEnter={() => onPrefetch(customer.id, selectedDate)}
      onTouchStart={() => onPrefetch(customer.id, selectedDate)}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Customer Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-800 font-bold text-sm">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{customer.name}</h3>
              <p className="text-sm text-gray-600">+91 {customer.phone}</p>
            </div>
          </div>

          <div className="ml-13 space-y-1">
            <p className="text-sm text-gray-600 line-clamp-2">{address}</p>

            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Plan:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {quantityLabel(delivery.quantityMl)}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">To Deliver:</span>
                <span className="text-sm font-medium text-gray-900">
                  {delivery.largeBottles > 0 && `${delivery.largeBottles}×1L`}
                  {delivery.largeBottles > 0 && delivery.smallBottles > 0 && ', '}
                  {delivery.smallBottles > 0 && `${delivery.smallBottles}×500ml`}
                </span>
              </div>

              {isCompleted && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Collected:</span>
                  <span className="text-sm font-medium text-gray-900">{bottlesCollected}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Status & Action */}
        <div className="flex-shrink-0 flex flex-col items-end gap-3">
          {delivery.status === 'DELIVERED' ? (
            <Badge variant="success" className="whitespace-nowrap">
              ✓ Delivered
            </Badge>
          ) : delivery.status === 'NOT_DELIVERED' ? (
            <Badge variant="error" className="whitespace-nowrap">
              ✗ Not Delivered
            </Badge>
          ) : (
            <Badge variant="warning" className="whitespace-nowrap">
              Pending
            </Badge>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(customer.id);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isCompleted
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-green-500 text-white hover:bg-green-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            {isCompleted ? 'View' : 'Mark Status'}
          </button>
        </div>
      </div>
    </div>
  );
};

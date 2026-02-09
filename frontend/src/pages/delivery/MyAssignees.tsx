import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Eye, Users } from 'lucide-react';
import { useAssignees } from '../../hooks/useDeliveryData';

type AssigneeRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  plan: string;
  status: string;
  displayStatus: string;
  hasDeliveryToday?: boolean;
  deliveryStatus?: string | null;
};

export const MyAssignees: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error: queryError } = useAssignees();
  const assignees = data?.assignees ?? [];
  const error = queryError ? 'Could not load assignees' : null;

  const statusVariant = (displayStatus: string) => {
    switch (displayStatus) {
      case 'Active': return 'success';
      case 'Inactive': return 'error';
      case 'Paused': return 'warning';
      case 'Pending': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading assignees...</p>
          </div>
        </div>
      </DeliveryLayout>
    );
  }

  if (error) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </DeliveryLayout>
    );
  }

  return (
    <DeliveryLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-800" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">My Assignees</h1>
            <p className="text-sm sm:text-base text-gray-600">Complete list of customers assigned to you</p>
          </div>
        </div>

        {assignees.length === 0 ? (
          <Card className="p-12 text-center text-gray-500">
            No customers assigned yet. New assignees from admin will appear here.
          </Card>
        ) : (
          <>
            {/* Desktop table view */}
            <Card className="overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Phone</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Address</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Plan</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Today</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignees.map((a, index) => (
                      <tr
                        key={a.id}
                        className="border-b border-gray-200 hover:bg-green-50/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/delivery/customer/${a.id}`)}
                      >
                        <td className="py-4 px-4 font-semibold text-gray-900">{index + 1}</td>
                        <td className="py-4 px-4 font-medium text-gray-900">{a.name}</td>
                        <td className="py-4 px-4 text-gray-600">+91 {a.phone}</td>
                        <td className="py-4 px-4 text-gray-600 max-w-[220px] truncate" title={a.address}>
                          {a.address}
                        </td>
                        <td className="py-4 px-4 font-semibold">{a.plan}</td>
                        <td className="py-4 px-4">
                          <Badge variant={statusVariant(a.displayStatus) as any}>{a.displayStatus}</Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {a.hasDeliveryToday ? (
                            <Badge
                              variant={
                                a.deliveryStatus === 'DELIVERED'
                                  ? 'success'
                                  : a.deliveryStatus === 'NOT_DELIVERED'
                                  ? 'error'
                                  : 'default'
                              }
                            >
                              {a.deliveryStatus === 'DELIVERED'
                                ? '✓ Done'
                                : a.deliveryStatus === 'NOT_DELIVERED'
                                ? '✗ Not Done'
                                : 'Pending'}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="p-2 hover:bg-green-100 rounded-lg text-green-800"
                            onClick={() => navigate(`/delivery/customer/${a.id}`)}
                            title="View / mark delivery"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {assignees.map((a, index) => (
                <Card
                  key={a.id}
                  className="p-4 cursor-pointer active:bg-gray-50"
                  onClick={() => navigate(`/delivery/customer/${a.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{a.name}</p>
                      <p className="text-sm text-gray-500">+91 {a.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <Badge variant={statusVariant(a.displayStatus) as any}>{a.displayStatus}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 truncate mb-2">{a.address}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{a.plan}</span>
                    {a.hasDeliveryToday ? (
                      <Badge
                        variant={
                          a.deliveryStatus === 'DELIVERED'
                            ? 'success'
                            : a.deliveryStatus === 'NOT_DELIVERED'
                            ? 'error'
                            : 'default'
                        }
                      >
                        {a.deliveryStatus === 'DELIVERED'
                          ? '✓ Done'
                          : a.deliveryStatus === 'NOT_DELIVERED'
                          ? '✗ Not Done'
                          : 'Pending'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">No delivery today</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DeliveryLayout>
  );
};

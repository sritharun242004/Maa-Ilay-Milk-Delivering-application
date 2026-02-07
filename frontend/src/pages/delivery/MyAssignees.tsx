import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeliveryLayout } from '../../components/layouts/DeliveryLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Eye, Users, Package, Phone, MapPin } from 'lucide-react';

type AssigneeRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  plan: string;
  status: string;
  // Full details for modal pre-fetching
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  deliveryNotes?: string | null;
  city?: string;
  pincode?: string;
  subscription: {
    dailyQuantityMl: number;
    status: string;
  } | null;
};

// Full details for modal
interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  deliveryNotes?: string | null;
  city?: string;
  pincode?: string;
  status: string;
  subscription: {
    dailyQuantityMl: number;
    status: string;
  } | null;
}

export const MyAssignees: React.FC = () => {
  const navigate = useNavigate();
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/assignees', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load assignees');
        return res.json();
      })
      .then((data) => setAssignees(data.assignees ?? []))
      .catch(() => setError('Could not load assignees'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateView = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Find customer in existing list
    const customer = assignees.find(a => a.id === id);
    if (customer) {
      setIsModalOpen(true);
      // Use local data immediately - no loading state needed!
      setSelectedCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        landmark: customer.landmark,
        deliveryNotes: customer.deliveryNotes,
        city: customer.city,
        pincode: customer.pincode,
        status: customer.status,
        subscription: customer.subscription
      });
    }
  };

  const statusVariant = (s: string) =>
    s === 'ACTIVE' ? 'success' : s === 'PENDING_APPROVAL' ? 'warning' : 'default';
  const statusLabel = (s: string) =>
    s === 'PENDING_APPROVAL' ? 'Pending' : s === 'ACTIVE' ? 'Active' : s.replace(/_/g, ' ');

  if (loading) {
    return (
      <DeliveryLayout>
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
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
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Assignees</h1>
            <p className="text-gray-600">Complete list of customers assigned to you (newest first)</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          {assignees.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No customers assigned yet. New assignees from admin will appear here.
            </div>
          ) : (
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
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignees.map((a, index) => (
                    <tr
                      key={a.id}
                      className="border-b border-gray-200 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                      onClick={(e) => handleCreateView(a.id, e)}
                    >
                      <td className="py-4 px-4 font-semibold text-gray-900">{index + 1}</td>
                      <td className="py-4 px-4 font-medium text-gray-900">{a.name}</td>
                      <td className="py-4 px-4 text-gray-600">+91 {a.phone}</td>
                      <td className="py-4 px-4 text-gray-600 max-w-[220px] truncate" title={a.address}>
                        {a.address}
                      </td>
                      <td className="py-4 px-4 font-semibold">{a.plan}</td>
                      <td className="py-4 px-4">
                        <Badge variant={statusVariant(a.status) as any}>{statusLabel(a.status)}</Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-600"
                          onClick={(e) => handleCreateView(a.id, e)}
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Customer Details Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Customer Details"
          size="lg"
        >
          {modalLoading ? (
            <div className="p-8 text-center text-gray-500">Loading details...</div>
          ) : selectedCustomer ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Package className="w-4 h-4" />
                      <span>Customer Name</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Phone className="w-4 h-4" />
                      <span>Phone Number</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">+91 {selectedCustomer.phone}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span>Full Address</span>
                    </div>
                    <div className="text-gray-900">
                      <p className="font-semibold">{selectedCustomer.addressLine1 || 'No address provided'}</p>
                      {selectedCustomer.addressLine2 && (
                        <p className="text-gray-700">{selectedCustomer.addressLine2}</p>
                      )}
                      {selectedCustomer.landmark && (
                        <p className="text-gray-600 italic">Landmark: {selectedCustomer.landmark}</p>
                      )}
                      {(selectedCustomer.city || selectedCustomer.pincode) && (
                        <p className="text-gray-600">
                          {selectedCustomer.city || ''} {selectedCustomer.pincode || ''}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedCustomer.deliveryNotes && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Special Delivery Instructions</p>
                      <p className="text-blue-800">{selectedCustomer.deliveryNotes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    navigate(`/delivery/customer/${selectedCustomer.id}`);
                  }}
                  className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                >
                  Go to Action Page
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">Failed to load details</div>
          )}
        </Modal>
      </div>
    </DeliveryLayout>
  );
};

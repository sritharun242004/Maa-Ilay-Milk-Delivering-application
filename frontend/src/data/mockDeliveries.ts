export interface Delivery {
  id: string;
  customerId: string;
  date: string;
  quantity: string;
  status: 'delivered' | 'not-delivered' | 'pending';
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  remarks?: string;
  bottlesCollected?: number;
  bottleType?: '1L' | '500ml';
}

export const mockDeliveries: Delivery[] = [
  {
    id: '1',
    customerId: '1',
    date: '2024-01-29',
    quantity: '1L',
    status: 'delivered',
    deliveryPersonId: '1',
    deliveryPersonName: 'Rajesh Kumar',
    bottlesCollected: 1,
    bottleType: '1L',
  },
  {
    id: '2',
    customerId: '2',
    date: '2024-01-29',
    quantity: '2L',
    status: 'delivered',
    deliveryPersonId: '1',
    deliveryPersonName: 'Rajesh Kumar',
    bottlesCollected: 2,
    bottleType: '1L',
  },
  {
    id: '3',
    customerId: '3',
    date: '2024-01-29',
    quantity: '500ml',
    status: 'delivered',
    deliveryPersonId: '7',
    deliveryPersonName: 'Kumar Das',
    bottlesCollected: 1,
    bottleType: '500ml',
  },
  {
    id: '4',
    customerId: '1',
    date: '2024-01-28',
    quantity: '1L',
    status: 'delivered',
    deliveryPersonId: '1',
    deliveryPersonName: 'Rajesh Kumar',
  },
  {
    id: '5',
    customerId: '1',
    date: '2024-01-27',
    quantity: '1L',
    status: 'not-delivered',
    deliveryPersonId: '1',
    deliveryPersonName: 'Rajesh Kumar',
    remarks: 'Customer not home',
  },
];

export const getTodayDeliveries = (deliveryPersonId: string): Delivery[] => {
  return [
    {
      id: '101',
      customerId: '1',
      date: '2024-01-29',
      quantity: '1L',
      status: 'pending',
      deliveryPersonId,
    },
    {
      id: '102',
      customerId: '2',
      date: '2024-01-29',
      quantity: '2L',
      status: 'pending',
      deliveryPersonId,
    },
  ];
};

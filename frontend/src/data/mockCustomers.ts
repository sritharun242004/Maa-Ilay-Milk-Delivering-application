export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  doorNo: string;
  plan: '1L' | '500ml';
  status: 'active' | 'pending' | 'inactive';
  walletBalance: number;
  zone: 'Zone 1' | 'Zone 2';
  deliveryPersonId?: string;
  subscription: {
    dailyQuantity: number;
    pauseDaysUsed: number;
    nextDelivery: string;
  };
  specialInstructions?: string;
}

export const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Priya Sharma',
    phone: '+91 98765 11111',
    address: 'Auroville Main Road',
    doorNo: '42',
    plan: '1L',
    status: 'active',
    walletBalance: 1250,
    zone: 'Zone 1',
    deliveryPersonId: '1',
    subscription: {
      dailyQuantity: 1,
      pauseDaysUsed: 2,
      nextDelivery: '2024-01-30',
    },
    specialInstructions: 'Leave at door if not home',
  },
  {
    id: '2',
    name: 'Amit Kumar',
    phone: '+91 98765 22222',
    address: 'Solitude Farm Road',
    doorNo: '15',
    plan: '1L',
    status: 'active',
    walletBalance: 800,
    zone: 'Zone 1',
    deliveryPersonId: '1',
    subscription: {
      dailyQuantity: 2,
      pauseDaysUsed: 0,
      nextDelivery: '2024-01-30',
    },
  },
  {
    id: '3',
    name: 'Lakshmi Devi',
    phone: '+91 98765 33333',
    address: 'White Town',
    doorNo: '28A',
    plan: '500ml',
    status: 'active',
    walletBalance: 450,
    zone: 'Zone 2',
    deliveryPersonId: '7',
    subscription: {
      dailyQuantity: 1,
      pauseDaysUsed: 1,
      nextDelivery: '2024-01-30',
    },
  },
  {
    id: '4',
    name: 'Ravi Chandran',
    phone: '+91 98765 44444',
    address: 'Aspiration Community',
    doorNo: '7',
    plan: '1L',
    status: 'pending',
    walletBalance: 0,
    zone: 'Zone 1',
    subscription: {
      dailyQuantity: 1,
      pauseDaysUsed: 0,
      nextDelivery: 'Pending approval',
    },
  },
  {
    id: '5',
    name: 'Meera Patel',
    phone: '+91 98765 55555',
    address: 'Beach Road',
    doorNo: '103',
    plan: '1L',
    status: 'active',
    walletBalance: 2100,
    zone: 'Zone 2',
    deliveryPersonId: '8',
    subscription: {
      dailyQuantity: 1,
      pauseDaysUsed: 3,
      nextDelivery: '2024-01-30',
    },
  },
];

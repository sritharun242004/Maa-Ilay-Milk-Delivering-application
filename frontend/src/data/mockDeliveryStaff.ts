export interface DeliveryStaff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  zone: 'Zone 1' | 'Zone 2';
  status: 'active' | 'on-leave' | 'sick';
  vehicleType: 'bike' | 'van';
  vehicleNumber: string;
  todayLoad: number;
  maxLoad: number;
}

export const mockDeliveryStaff: DeliveryStaff[] = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    phone: '+91 96000 42507',
    email: 'rajesh@maailay.com',
    zone: 'Zone 1',
    status: 'active',
    vehicleType: 'bike',
    vehicleNumber: 'TN-01-AB-1234',
    todayLoad: 18,
    maxLoad: 20,
  },
  {
    id: '2',
    name: 'Suresh Babu',
    phone: '+91 96000 42508',
    zone: 'Zone 1',
    status: 'active',
    vehicleType: 'bike',
    vehicleNumber: 'TN-01-AB-1235',
    todayLoad: 15,
    maxLoad: 20,
  },
  {
    id: '7',
    name: 'Kumar Das',
    phone: '+91 96000 42509',
    zone: 'Zone 2',
    status: 'active',
    vehicleType: 'van',
    vehicleNumber: 'TN-01-CD-5678',
    todayLoad: 22,
    maxLoad: 30,
  },
  {
    id: '8',
    name: 'Anand Raj',
    phone: '+91 96000 42510',
    zone: 'Zone 2',
    status: 'active',
    vehicleType: 'bike',
    vehicleNumber: 'TN-01-CD-5679',
    todayLoad: 12,
    maxLoad: 20,
  },
  {
    id: '9',
    name: 'Vinod Kumar',
    phone: '+91 96000 42511',
    zone: 'Zone 1',
    status: 'on-leave',
    vehicleType: 'bike',
    vehicleNumber: 'TN-01-AB-1239',
    todayLoad: 0,
    maxLoad: 20,
  },
];

import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'customer' | 'admin' | 'delivery';
      email?: string;
      name?: string;
      phone?: string;
    }
  }
}

export {};

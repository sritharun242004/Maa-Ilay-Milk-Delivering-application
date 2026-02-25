import prisma from '../config/prisma';
import { GRACE_PERIOD_END_DAY } from '../config/constants';
import { getNowIST } from './dateUtils';

/**
 * Automatically determines the correct customer status based on current conditions
 *
 * Status Rules:
 * - VISITOR: No subscription yet
 * - PENDING_APPROVAL: Has subscription but no delivery person assigned
 * - ACTIVE: Has delivery person + sufficient wallet balance + monthly payment OK
 * - INACTIVE: Has delivery person but insufficient balance OR unpaid after grace period
 * - PAUSED: User manually paused (has any future pause dates)
 */
export async function calculateCustomerStatus(customerId: string): Promise<'VISITOR' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'PAUSED'> {
  const now = getNowIST();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      Subscription: true,
      Wallet: true,
      Pause: {
        where: {
          pauseDate: {
            gte: today
          }
        },
        take: 1,
      }
    }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // VISITOR: No subscription
  if (!customer.Subscription) {
    return 'VISITOR';
  }

  // PENDING_APPROVAL: Has subscription but no delivery person
  if (!customer.deliveryPersonId) {
    return 'PENDING_APPROVAL';
  }

  // PAUSED: Has any future pause dates (today or later)
  if (customer.Pause && customer.Pause.length > 0) {
    return 'PAUSED';
  }

  // After grace period (8th+): check monthly payment
  const currentDay = now.getDate();
  if (currentDay > GRACE_PERIOD_END_DAY) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    const monthlyPayment = await prisma.monthlyPayment.findUnique({
      where: { customerId_year_month: { customerId, year, month } },
    });

    if (!monthlyPayment || monthlyPayment.status !== 'PAID') {
      return 'INACTIVE';
    }
  }

  // Check wallet balance for ACTIVE vs INACTIVE
  const walletBalance = customer.Wallet?.balancePaise ?? 0;

  if (walletBalance >= 0) {
    return 'ACTIVE';
  } else {
    return 'INACTIVE';
  }
}

/**
 * Updates customer status in database based on current conditions
 * Returns the new status
 */
export async function updateCustomerStatus(customerId: string): Promise<'VISITOR' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'PAUSED'> {
  const newStatus = await calculateCustomerStatus(customerId);

  await prisma.customer.update({
    where: { id: customerId },
    data: { status: newStatus }
  });

  return newStatus;
}

/**
 * Checks if customer can receive deliveries today
 * Used by delivery person routes
 */
export async function canReceiveDelivery(customerId: string): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      Subscription: true,
      Wallet: true,
    }
  });

  if (!customer || !customer.Subscription || !customer.deliveryPersonId) {
    return false;
  }

  // Check if paused for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const isPaused = await prisma.pause.findFirst({
    where: {
      customerId,
      pauseDate: {
        gte: today,
        lte: todayEnd
      }
    }
  });

  if (isPaused) {
    return false;
  }

  // After grace period: check monthly payment
  const now = getNowIST();
  const currentDay = now.getDate();
  if (currentDay > GRACE_PERIOD_END_DAY) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthlyPayment = await prisma.monthlyPayment.findUnique({
      where: { customerId_year_month: { customerId, year, month } },
    });

    if (!monthlyPayment || monthlyPayment.status !== 'PAID') {
      return false;
    }
  }

  // Check wallet balance — negative = can't receive delivery
  const walletBalance = customer.Wallet?.balancePaise ?? 0;
  return walletBalance >= 0;
}

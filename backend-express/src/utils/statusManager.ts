import prisma from '../config/prisma';
import { GRACE_PERIOD_END_DAY } from '../config/constants';
import { calculateDailyPricePaise } from '../config/pricing';
import { getNowIST } from './dateUtils';

/**
 * Automatically determines the correct customer status based on current conditions
 *
 * Status Rules:
 * - VISITOR: No subscription yet
 * - PENDING_APPROVAL: Has subscription but no delivery person assigned
 * - ACTIVE: Has delivery person + sufficient wallet balance (wallet-based gating)
 * - INACTIVE: Has delivery person but wallet insufficient for 1 delivery (after grace period)
 * - PAUSED: User manually paused (has any future pause dates)
 *
 * Grace period (days 1-7): ACTIVE regardless of wallet balance
 * After grace period (8th+): wallet must cover at least 1 day's delivery
 * MonthlyPayment status is for tracking only, NOT a gating mechanism.
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

  // During grace period (days 1-7): ACTIVE regardless of wallet balance
  const currentDay = now.getDate();
  if (currentDay <= GRACE_PERIOD_END_DAY) {
    return 'ACTIVE';
  }

  // After grace period (8th+): wallet must cover at least 1 day's delivery
  const walletBalance = customer.Wallet?.balancePaise ?? 0;
  const dailyRate = await calculateDailyPricePaise(customer.Subscription.dailyQuantityMl);

  if (walletBalance >= dailyRate) {
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
 *
 * Grace period (days 1-7): allow delivery even with negative balance
 * After grace period (8th+): wallet must cover at least 1 day's delivery
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

  // Check if paused for today (use IST timezone for consistency)
  const nowIST = getNowIST();
  const today = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 23, 59, 59, 999);

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

  // During grace period (days 1-7): allow delivery regardless of wallet balance
  const currentDay = nowIST.getDate();
  if (currentDay <= GRACE_PERIOD_END_DAY) {
    return true;
  }

  // After grace period (8th+): wallet must cover at least 1 day's delivery
  const walletBalance = customer.Wallet?.balancePaise ?? 0;
  const dailyRate = await calculateDailyPricePaise(customer.Subscription.dailyQuantityMl);
  return walletBalance >= dailyRate;
}

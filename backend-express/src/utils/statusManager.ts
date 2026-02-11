import prisma from '../config/prisma';

/**
 * Automatically determines the correct customer status based on current conditions
 *
 * Status Rules:
 * - VISITOR: No subscription yet
 * - PENDING_APPROVAL: Has subscription but no delivery person assigned
 * - ACTIVE: Has delivery person + sufficient wallet balance
 * - INACTIVE: Has delivery person but insufficient wallet balance
 * - PAUSED: User manually paused (has any future pause dates)
 */
export async function calculateCustomerStatus(customerId: string): Promise<'VISITOR' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'PAUSED'> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      Subscription: true,
      Wallet: true,
      Pause: {
        where: {
          // FIX: Check for any future pauses (today onwards)
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

  // FIX: PAUSED: Has any future pause dates (today or later)
  if (customer.Pause && customer.Pause.length > 0) {
    return 'PAUSED';
  }

  // Check wallet balance for ACTIVE vs INACTIVE
  const walletBalance = customer.Wallet?.balancePaise ?? 0;

  // Balance < 0 = INACTIVE (once negative, no more deliveries until top-up)
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

  // Check wallet balance — negative = can't receive delivery
  const walletBalance = customer.Wallet?.balancePaise ?? 0;
  return walletBalance >= 0;
}

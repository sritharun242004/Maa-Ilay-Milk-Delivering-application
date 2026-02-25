import prisma from '../config/prisma';

// Penalty pricing (in paise)
const LARGE_BOTTLE_PENALTY_PAISE = 3500; // ₹35
const SMALL_BOTTLE_PENALTY_PAISE = 2500; // ₹25
const PENALTY_THRESHOLD_DAYS = 3; // Changed to 3 days

type PenaltyResult = {
  customerId: string;
  customerName: string;
  largeBottlesPenalized: number;
  smallBottlesPenalized: number;
  totalPenaltyPaise: number;
  success: boolean;
  error?: string;
};

/**
 * Check all customers for bottles not returned after 5 days and charge penalties
 */
export async function checkAndChargePenalties(): Promise<PenaltyResult[]> {
  const results: PenaltyResult[] = [];

  try {
    // Get all active customers with bottle balances
    const customers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        BottleLedger: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const customer of customers) {
      const latestBalance = customer.BottleLedger[0];

      // Skip customers with no bottles out
      if (!latestBalance || (latestBalance.largeBottleBalanceAfter === 0 && latestBalance.smallBottleBalanceAfter === 0)) {
        continue;
      }

      try {
        const result = await checkCustomerPenalties(customer.id, customer.name);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error checking penalties for customer ${customer.id}:`, error);
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          largeBottlesPenalized: 0,
          smallBottlesPenalized: 0,
          totalPenaltyPaise: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in checkAndChargePenalties:', error);
    throw error;
  }
}

/**
 * Check and charge penalties for a specific customer
 */
async function checkCustomerPenalties(customerId: string, customerName: string): Promise<PenaltyResult | null> {
  const now = new Date();
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - PENALTY_THRESHOLD_DAYS);

  // Find bottles issued more than 5 days ago that haven't been penalized or returned
  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      customerId,
      action: 'ISSUED',
      issuedDate: {
        lte: fiveDaysAgo,
      },
      penaltyAppliedAt: null,
      returnedAt: null,
    },
    orderBy: { issuedDate: 'asc' },
  });

  if (overdueBottles.length === 0) {
    return null;
  }

  // Count large and small bottles to penalize
  let largeBottlesPenalized = 0;
  let smallBottlesPenalized = 0;

  for (const bottle of overdueBottles) {
    if (bottle.size === 'LARGE') {
      largeBottlesPenalized += bottle.quantity;
    } else {
      smallBottlesPenalized += bottle.quantity;
    }
  }

  // Calculate total penalty
  const totalPenaltyPaise =
    (largeBottlesPenalized * LARGE_BOTTLE_PENALTY_PAISE) +
    (smallBottlesPenalized * SMALL_BOTTLE_PENALTY_PAISE);

  if (totalPenaltyPaise === 0) {
    return null;
  }

  try {
    // Charge penalty in a transaction
    await prisma.$transaction(async (tx) => {
      // Get customer wallet
      const wallet = await tx.wallet.findUnique({
        where: { customerId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Deduct penalty from wallet
      const newBalance = wallet.balancePaise - totalPenaltyPaise;

      await tx.wallet.update({
        where: { customerId },
        data: { balancePaise: newBalance },
      });

      // Create wallet transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PENALTY_CHARGE',
          amountPaise: -totalPenaltyPaise,
          balanceAfterPaise: newBalance,
          description: `Penalty for ${largeBottlesPenalized} × 1L and ${smallBottlesPenalized} × 500ml bottles not returned after 5 days`,
          referenceType: 'penalty',
        },
      });

      // Mark all overdue bottles as penalized
      const bottleIds = overdueBottles.map((b) => b.id);
      await tx.bottleLedger.updateMany({
        where: {
          id: { in: bottleIds },
        },
        data: {
          penaltyAppliedAt: now,
        },
      });

      // Create penalty ledger entries
      const latestLedger = await tx.bottleLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });

      const currentLargeBalance = latestLedger?.largeBottleBalanceAfter ?? 0;
      const currentSmallBalance = latestLedger?.smallBottleBalanceAfter ?? 0;

      if (largeBottlesPenalized > 0) {
        await tx.bottleLedger.create({
          data: {
            customerId,
            action: 'PENALTY_CHARGED',
            size: 'LARGE',
            quantity: largeBottlesPenalized,
            largeBottleBalanceAfter: Math.max(0, currentLargeBalance - largeBottlesPenalized),
            smallBottleBalanceAfter: currentSmallBalance,
            description: `Penalty charged for ${largeBottlesPenalized} × 1L bottles not returned after 5 days (₹${LARGE_BOTTLE_PENALTY_PAISE / 100} per bottle)`,
            penaltyAppliedAt: now,
          },
        });
      }

      if (smallBottlesPenalized > 0) {
        await tx.bottleLedger.create({
          data: {
            customerId,
            action: 'PENALTY_CHARGED',
            size: 'SMALL',
            quantity: smallBottlesPenalized,
            largeBottleBalanceAfter: largeBottlesPenalized > 0 ? Math.max(0, currentLargeBalance - largeBottlesPenalized) : currentLargeBalance,
            smallBottleBalanceAfter: Math.max(0, currentSmallBalance - smallBottlesPenalized),
            description: `Penalty charged for ${smallBottlesPenalized} × 500ml bottles not returned after 5 days (₹${SMALL_BOTTLE_PENALTY_PAISE / 100} per bottle)`,
            penaltyAppliedAt: now,
          },
        });
      }
    });

    return {
      customerId,
      customerName,
      largeBottlesPenalized,
      smallBottlesPenalized,
      totalPenaltyPaise,
      success: true,
    };
  } catch (error) {
    console.error(`Error charging penalty for customer ${customerId}:`, error);
    return {
      customerId,
      customerName,
      largeBottlesPenalized,
      smallBottlesPenalized,
      totalPenaltyPaise,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Combined: get penalty stats + flagged customer details in TWO queries max.
 * 1) Overdue bottles with customer info (single query)
 * 2) Latest balances for flagged customers (single batched query)
 *
 * Optimized for remote DB: minimizes round-trips since each query has ~150ms latency.
 */
export async function getPenaltiesData() {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() - PENALTY_THRESHOLD_DAYS);

  // Query 1: overdue bottles + customer balance in one go
  // Include the latest ledger entry per customer to avoid separate balance queries
  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      action: 'ISSUED',
      OR: [
        { issuedDate: { lte: thresholdDate } },
        { AND: [{ issuedDate: null }, { createdAt: { lte: thresholdDate } }] },
      ],
      penaltyAppliedAt: null,
      returnedAt: null,
    },
    include: {
      Customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          DeliveryPerson: { select: { name: true } },
          // Include latest bottle ledger entry to get current balance
          BottleLedger: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              largeBottleBalanceAfter: true,
              smallBottleBalanceAfter: true,
            },
          },
        },
      },
    },
    orderBy: { issuedDate: 'asc' },
  });

  if (overdueBottles.length === 0) {
    return {
      totalPendingBottles: 0,
      flaggedCustomersCount: 0,
      flaggedCustomers: [] as any[],
      rules: [
        `Bottle not returned after ${PENALTY_THRESHOLD_DAYS} days: ₹${LARGE_BOTTLE_PENALTY_PAISE / 100} (1L), ₹${SMALL_BOTTLE_PENALTY_PAISE / 100} (500ml)`,
      ],
    };
  }

  // Build flagged customers map and stats in single pass (no extra queries needed)
  let totalPendingBottles = 0;
  const customerMap = new Map<string, {
    id: string;
    name: string;
    phone: string;
    deliveryPersonName: string;
    largeBottles: number;
    smallBottles: number;
    balanceLarge: number;
    balanceSmall: number;
    oldestBottleDate: Date;
    daysOverdue: number;
  }>();

  for (const bottle of overdueBottles) {
    const latestLedger = bottle.Customer.BottleLedger[0];
    const balanceLarge = latestLedger?.largeBottleBalanceAfter ?? 0;
    const balanceSmall = latestLedger?.smallBottleBalanceAfter ?? 0;

    // Skip customers with no bottles currently outstanding
    if (balanceLarge === 0 && balanceSmall === 0) continue;

    totalPendingBottles += bottle.quantity;

    const bottleDate = bottle.issuedDate ? new Date(bottle.issuedDate) : new Date(bottle.createdAt);
    const daysOverdue = Math.floor((now.getTime() - bottleDate.getTime()) / (1000 * 60 * 60 * 24));

    const existing = customerMap.get(bottle.customerId);
    if (existing) {
      if (bottle.size === 'LARGE') existing.largeBottles += bottle.quantity;
      else existing.smallBottles += bottle.quantity;
      if (bottleDate < existing.oldestBottleDate) {
        existing.oldestBottleDate = bottleDate;
        existing.daysOverdue = daysOverdue;
      }
    } else {
      customerMap.set(bottle.customerId, {
        id: bottle.customerId,
        name: bottle.Customer.name,
        phone: bottle.Customer.phone,
        deliveryPersonName: bottle.Customer.DeliveryPerson?.name || 'Unassigned',
        largeBottles: bottle.size === 'LARGE' ? bottle.quantity : 0,
        smallBottles: bottle.size === 'SMALL' ? bottle.quantity : 0,
        balanceLarge,
        balanceSmall,
        oldestBottleDate: bottleDate,
        daysOverdue,
      });
    }
  }

  // Cap at actual current balance
  for (const [customerId, entry] of customerMap) {
    entry.largeBottles = Math.min(entry.largeBottles, entry.balanceLarge);
    entry.smallBottles = Math.min(entry.smallBottles, entry.balanceSmall);
    if (entry.largeBottles === 0 && entry.smallBottles === 0) {
      customerMap.delete(customerId);
    }
  }

  const flaggedCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      deliveryPersonName: c.deliveryPersonName,
      largeBottles: c.largeBottles,
      smallBottles: c.smallBottles,
      totalBottles: c.largeBottles + c.smallBottles,
      oldestBottleDate: c.oldestBottleDate,
      daysOverdue: c.daysOverdue,
    }));

  return {
    totalPendingBottles,
    flaggedCustomersCount: flaggedCustomers.length,
    flaggedCustomers,
    rules: [
      `Bottle not returned after ${PENALTY_THRESHOLD_DAYS} days: ₹${LARGE_BOTTLE_PENALTY_PAISE / 100} (1L), ₹${SMALL_BOTTLE_PENALTY_PAISE / 100} (500ml)`,
    ],
  };
}

/**
 * Manually impose fine on a specific customer for unreturned bottles.
 * Supports partial fining — admin chooses how many bottles to fine (oldest first).
 */
export async function imposePenaltyOnCustomer(
  customerId: string,
  fineAmountPaise: number,
  largeBottlesToFine: number,
  smallBottlesToFine: number
): Promise<{
  success: boolean;
  message: string;
  totalCharged?: number;
}> {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() - PENALTY_THRESHOLD_DAYS);

  try {
    // Pre-fetch overdue bottles AND wallet + latest balance in parallel (before transaction)
    const [overdueBottles, wallet, latestLedger] = await Promise.all([
      prisma.bottleLedger.findMany({
        where: {
          customerId,
          action: 'ISSUED',
          OR: [
            { issuedDate: { lte: thresholdDate } },
            { AND: [{ issuedDate: null }, { createdAt: { lte: thresholdDate } }] },
          ],
          penaltyAppliedAt: null,
          returnedAt: null,
        },
        orderBy: [{ issuedDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.wallet.findUnique({ where: { customerId } }),
      prisma.bottleLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { largeBottleBalanceAfter: true, smallBottleBalanceAfter: true },
      }),
    ]);

    if (overdueBottles.length === 0) {
      return { success: false, message: 'No overdue bottles found for this customer' };
    }
    if (!wallet) {
      return { success: false, message: 'Wallet not found' };
    }

    // Separate by size and pick the oldest N entries for each
    const largeEntries = overdueBottles.filter(b => b.size === 'LARGE');
    const smallEntries = overdueBottles.filter(b => b.size === 'SMALL');

    // Collect bottle IDs to mark as penalized (oldest first, up to requested count)
    const idsToMark: string[] = [];
    let largeMarked = 0;
    for (const entry of largeEntries) {
      if (largeMarked >= largeBottlesToFine) break;
      idsToMark.push(entry.id);
      largeMarked += entry.quantity;
    }

    let smallMarked = 0;
    for (const entry of smallEntries) {
      if (smallMarked >= smallBottlesToFine) break;
      idsToMark.push(entry.id);
      smallMarked += entry.quantity;
    }

    const totalFined = largeMarked + smallMarked;
    if (totalFined <= 0) {
      return { success: false, message: 'No bottles selected to fine' };
    }

    const fineRs = fineAmountPaise / 100;
    const newBalance = wallet.balancePaise - fineAmountPaise;
    const currentLargeBalance = latestLedger?.largeBottleBalanceAfter ?? 0;
    const currentSmallBalance = latestLedger?.smallBottleBalanceAfter ?? 0;

    // Build description
    const parts: string[] = [];
    if (largeMarked > 0) parts.push(`${largeMarked}×1L`);
    if (smallMarked > 0) parts.push(`${smallMarked}×500ml`);

    // Transaction: only writes, no reads (all data pre-fetched above)
    await prisma.$transaction([
      prisma.wallet.update({
        where: { customerId },
        data: { balancePaise: newBalance },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PENALTY_CHARGE',
          amountPaise: -fineAmountPaise,
          balanceAfterPaise: newBalance,
          description: `Fine for empty bottles — ${totalFined} bottle${totalFined > 1 ? 's' : ''} not returned (${parts.join(', ')})`,
          referenceType: 'penalty',
        },
      }),
      prisma.bottleLedger.updateMany({
        where: { id: { in: idsToMark } },
        data: { penaltyAppliedAt: now },
      }),
      ...(largeMarked > 0 ? [prisma.bottleLedger.create({
        data: {
          customerId,
          action: 'PENALTY_CHARGED',
          size: 'LARGE',
          quantity: largeMarked,
          largeBottleBalanceAfter: Math.max(0, currentLargeBalance - largeMarked),
          smallBottleBalanceAfter: currentSmallBalance,
          description: `Fine for empty bottles: ${largeMarked} × 1L (₹${fineRs})`,
          penaltyAppliedAt: now,
        },
      })] : []),
      ...(smallMarked > 0 ? [prisma.bottleLedger.create({
        data: {
          customerId,
          action: 'PENALTY_CHARGED',
          size: 'SMALL',
          quantity: smallMarked,
          largeBottleBalanceAfter: largeMarked > 0 ? Math.max(0, currentLargeBalance - largeMarked) : currentLargeBalance,
          smallBottleBalanceAfter: Math.max(0, currentSmallBalance - smallMarked),
          description: `Fine for empty bottles: ${smallMarked} × 500ml (₹${fineRs})`,
          penaltyAppliedAt: now,
        },
      })] : []),
    ]);

    return {
      success: true,
      message: `Fine of ₹${fineRs} imposed for ${totalFined} unreturned bottle${totalFined > 1 ? 's' : ''}`,
      totalCharged: fineRs,
    };
  } catch (error) {
    console.error('Error imposing fine:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to impose fine',
    };
  }
}

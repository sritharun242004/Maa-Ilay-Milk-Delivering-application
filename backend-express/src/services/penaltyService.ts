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

  // Find bottles issued more than 5 days ago that haven't been penalized
  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      customerId,
      action: 'ISSUED',
      issuedDate: {
        lte: fiveDaysAgo,
      },
      penaltyAppliedAt: null,
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
 * Get detailed flagged customers list with bottle information
 */
export async function getFlaggedCustomersDetailed() {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() - PENALTY_THRESHOLD_DAYS);

  // Find customers with overdue bottles
  // FIX: Handle both issuedDate and createdAt (fallback for old records without issuedDate)
  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      action: 'ISSUED',
      OR: [
        {
          issuedDate: {
            lte: thresholdDate,
          }
        },
        {
          AND: [
            { issuedDate: null },
            {
              createdAt: {
                lte: thresholdDate,
              }
            }
          ]
        }
      ],
      penaltyAppliedAt: null,
    },
    include: {
      Customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          DeliveryPerson: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { issuedDate: 'asc' },
  });

  // Get unique customer IDs from overdue bottles
  const customerIds = [...new Set(overdueBottles.map(b => b.customerId))];

  // Get each customer's current bottle balance (from latest ledger entry)
  const customerBalances = new Map<string, { large: number; small: number }>();
  for (const customerId of customerIds) {
    const latestLedger = await prisma.bottleLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    customerBalances.set(customerId, {
      large: latestLedger?.largeBottleBalanceAfter ?? 0,
      small: latestLedger?.smallBottleBalanceAfter ?? 0,
    });
  }

  // Group by customer, but cap at actual current balance
  const customerMap = new Map<string, {
    id: string;
    name: string;
    phone: string;
    deliveryPersonName: string;
    largeBottles: number;
    smallBottles: number;
    oldestBottleDate: Date;
    daysOverdue: number;
    bottleLedgerIds: string[];
  }>();

  for (const bottle of overdueBottles) {
    const balance = customerBalances.get(bottle.customerId);
    // Skip customers with no bottles currently outstanding
    if (!balance || (balance.large === 0 && balance.small === 0)) continue;

    const existing = customerMap.get(bottle.customerId);
    const bottleDate = bottle.issuedDate ? new Date(bottle.issuedDate) : new Date(bottle.createdAt);
    const daysOverdue = Math.floor((now.getTime() - bottleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (existing) {
      if (bottle.size === 'LARGE') {
        existing.largeBottles += bottle.quantity;
      } else {
        existing.smallBottles += bottle.quantity;
      }
      existing.bottleLedgerIds.push(bottle.id);
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
        oldestBottleDate: bottleDate,
        daysOverdue,
        bottleLedgerIds: [bottle.id],
      });
    }
  }

  // Cap reported bottles at actual current balance
  for (const [customerId, entry] of customerMap) {
    const balance = customerBalances.get(customerId)!;
    entry.largeBottles = Math.min(entry.largeBottles, balance.large);
    entry.smallBottles = Math.min(entry.smallBottles, balance.small);
    // Remove entry if after capping, no bottles remain
    if (entry.largeBottles === 0 && entry.smallBottles === 0) {
      customerMap.delete(customerId);
    }
  }

  return Array.from(customerMap.values()).sort((a, b) => b.daysOverdue - a.daysOverdue);
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
    // Find customer's overdue bottles, ordered by date (oldest first)
    const overdueBottles = await prisma.bottleLedger.findMany({
      where: {
        customerId,
        action: 'ISSUED',
        OR: [
          { issuedDate: { lte: thresholdDate } },
          { AND: [{ issuedDate: null }, { createdAt: { lte: thresholdDate } }] },
        ],
        penaltyAppliedAt: null,
      },
      orderBy: [{ issuedDate: 'asc' }, { createdAt: 'asc' }],
    });

    if (overdueBottles.length === 0) {
      return { success: false, message: 'No overdue bottles found for this customer' };
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

    // Charge fine in transaction
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerId } });
      if (!wallet) throw new Error('Wallet not found');

      const newBalance = wallet.balancePaise - fineAmountPaise;

      await tx.wallet.update({
        where: { customerId },
        data: { balancePaise: newBalance },
      });

      // Build description
      const parts: string[] = [];
      if (largeMarked > 0) parts.push(`${largeMarked}×1L`);
      if (smallMarked > 0) parts.push(`${smallMarked}×500ml`);

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PENALTY_CHARGE',
          amountPaise: -fineAmountPaise,
          balanceAfterPaise: newBalance,
          description: `Fine for empty bottles — ${totalFined} bottle${totalFined > 1 ? 's' : ''} not returned (${parts.join(', ')})`,
          referenceType: 'penalty',
        },
      });

      // Mark only the selected oldest bottles as penalized
      await tx.bottleLedger.updateMany({
        where: { id: { in: idsToMark } },
        data: { penaltyAppliedAt: now },
      });

      // Create penalty ledger entries to update bottle balances
      const latestLedger = await tx.bottleLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });

      const currentLargeBalance = latestLedger?.largeBottleBalanceAfter ?? 0;
      const currentSmallBalance = latestLedger?.smallBottleBalanceAfter ?? 0;

      if (largeMarked > 0) {
        await tx.bottleLedger.create({
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
        });
      }

      if (smallMarked > 0) {
        await tx.bottleLedger.create({
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
        });
      }
    });

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

/**
 * Get penalty statistics
 */
export async function getPenaltyStatistics() {
  const now = new Date();

  // Calculate total pending (customers with overdue bottles)
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() - PENALTY_THRESHOLD_DAYS);

  // Match the same query as getFlaggedCustomersDetailed to get consistent counts
  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      action: 'ISSUED',
      OR: [
        {
          issuedDate: {
            lte: thresholdDate,
          },
        },
        {
          AND: [
            { issuedDate: null },
            {
              createdAt: {
                lte: thresholdDate,
              },
            },
          ],
        },
      ],
      penaltyAppliedAt: null,
    },
    include: {
      Customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get each customer's actual current bottle balance
  const customerIds = [...new Set(overdueBottles.map(b => b.customerId))];
  const customerBalances = new Map<string, { large: number; small: number }>();
  for (const customerId of customerIds) {
    const latestLedger = await prisma.bottleLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    customerBalances.set(customerId, {
      large: latestLedger?.largeBottleBalanceAfter ?? 0,
      small: latestLedger?.smallBottleBalanceAfter ?? 0,
    });
  }

  // Only count customers who actually have bottles outstanding
  let totalPendingBottles = 0;
  const flaggedCustomerIds = new Set<string>();

  for (const bottle of overdueBottles) {
    const balance = customerBalances.get(bottle.customerId);
    if (!balance || (balance.large === 0 && balance.small === 0)) continue;
    totalPendingBottles += bottle.quantity;
    flaggedCustomerIds.add(bottle.customerId);
  }

  return {
    totalPendingBottles,
    flaggedCustomersCount: flaggedCustomerIds.size,
    rules: [
      `Bottle not returned after ${PENALTY_THRESHOLD_DAYS} days: ₹${LARGE_BOTTLE_PENALTY_PAISE / 100} (1L), ₹${SMALL_BOTTLE_PENALTY_PAISE / 100} (500ml)`,
    ],
  };
}

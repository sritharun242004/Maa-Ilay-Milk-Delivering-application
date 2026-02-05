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

  // Group by customer
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
    const existing = customerMap.get(bottle.customerId);
    // FIX: Use issuedDate if available, otherwise fall back to createdAt
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

  return Array.from(customerMap.values()).sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * Manually impose penalty on a specific customer
 */
export async function imposePenaltyOnCustomer(
  customerId: string,
  largeBottlePrice: number,
  smallBottlePrice: number
): Promise<{
  success: boolean;
  message: string;
  totalCharged?: number;
}> {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() - PENALTY_THRESHOLD_DAYS);

  try {
    // Find customer's overdue bottles
    // FIX: Handle both issuedDate and createdAt (fallback for old records)
    const overdueBottles = await prisma.bottleLedger.findMany({
      where: {
        customerId,
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
    });

    if (overdueBottles.length === 0) {
      return {
        success: false,
        message: 'No overdue bottles found for this customer',
      };
    }

    // Count bottles
    let largeBottles = 0;
    let smallBottles = 0;

    for (const bottle of overdueBottles) {
      if (bottle.size === 'LARGE') {
        largeBottles += bottle.quantity;
      } else {
        smallBottles += bottle.quantity;
      }
    }

    // Calculate total penalty (prices are in paise)
    const totalPenaltyPaise = (largeBottles * largeBottlePrice) + (smallBottles * smallBottlePrice);

    if (totalPenaltyPaise <= 0) {
      return {
        success: false,
        message: 'Invalid penalty amount',
      };
    }

    // Charge penalty in transaction
    await prisma.$transaction(async (tx) => {
      // Get customer wallet
      const wallet = await tx.wallet.findUnique({
        where: { customerId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Deduct penalty
      const newBalance = wallet.balancePaise - totalPenaltyPaise;

      await tx.wallet.update({
        where: { customerId },
        data: { balancePaise: newBalance },
      });

      // Create transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PENALTY_CHARGE',
          amountPaise: -totalPenaltyPaise,
          balanceAfterPaise: newBalance,
          description: `Manual penalty: ${largeBottles} × 1L (₹${largeBottlePrice / 100}) and ${smallBottles} × 500ml (₹${smallBottlePrice / 100}) bottles not returned after ${PENALTY_THRESHOLD_DAYS} days`,
          referenceType: 'penalty',
        },
      });

      // Mark bottles as penalized
      const bottleIds = overdueBottles.map((b) => b.id);
      await tx.bottleLedger.updateMany({
        where: { id: { in: bottleIds } },
        data: { penaltyAppliedAt: now },
      });

      // Create penalty ledger entries
      const latestLedger = await tx.bottleLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });

      const currentLargeBalance = latestLedger?.largeBottleBalanceAfter ?? 0;
      const currentSmallBalance = latestLedger?.smallBottleBalanceAfter ?? 0;

      if (largeBottles > 0) {
        await tx.bottleLedger.create({
          data: {
            customerId,
            action: 'PENALTY_CHARGED',
            size: 'LARGE',
            quantity: largeBottles,
            largeBottleBalanceAfter: Math.max(0, currentLargeBalance - largeBottles),
            smallBottleBalanceAfter: currentSmallBalance,
            description: `Manual penalty: ${largeBottles} × 1L bottles (₹${largeBottlePrice / 100} each)`,
            penaltyAppliedAt: now,
          },
        });
      }

      if (smallBottles > 0) {
        await tx.bottleLedger.create({
          data: {
            customerId,
            action: 'PENALTY_CHARGED',
            size: 'SMALL',
            quantity: smallBottles,
            largeBottleBalanceAfter: largeBottles > 0 ? Math.max(0, currentLargeBalance - largeBottles) : currentLargeBalance,
            smallBottleBalanceAfter: Math.max(0, currentSmallBalance - smallBottles),
            description: `Manual penalty: ${smallBottles} × 500ml bottles (₹${smallBottlePrice / 100} each)`,
            penaltyAppliedAt: now,
          },
        });
      }
    });

    return {
      success: true,
      message: `Penalty of ₹${totalPenaltyPaise / 100} imposed successfully`,
      totalCharged: totalPenaltyPaise / 100,
    };
  } catch (error) {
    console.error('Error imposing penalty:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to impose penalty',
    };
  }
}

/**
 * Get penalty statistics
 */
export async function getPenaltyStatistics() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all penalty transactions
  const allPenalties = await prisma.walletTransaction.findMany({
    where: {
      type: 'PENALTY_CHARGE',
    },
    select: {
      amountPaise: true,
      createdAt: true,
      Wallet: {
        select: {
          customerId: true,
        },
      },
    },
  });

  // Calculate total pending (customers with overdue bottles)
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - PENALTY_THRESHOLD_DAYS);

  const overdueBottles = await prisma.bottleLedger.findMany({
    where: {
      action: 'ISSUED',
      issuedDate: {
        lte: fiveDaysAgo,
      },
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

  // Calculate pending penalties
  let totalPendingPaise = 0;
  const flaggedCustomerIds = new Set<string>();

  for (const bottle of overdueBottles) {
    const penaltyPaise = bottle.size === 'LARGE' ? LARGE_BOTTLE_PENALTY_PAISE : SMALL_BOTTLE_PENALTY_PAISE;
    totalPendingPaise += bottle.quantity * penaltyPaise;
    flaggedCustomerIds.add(bottle.customerId);
  }

  // Calculate collected this month
  const collectedThisMonth = allPenalties
    .filter((p) => new Date(p.createdAt) >= monthStart)
    .reduce((sum, p) => sum + Math.abs(p.amountPaise), 0);

  // Get flagged customers details
  const flaggedCustomers = await prisma.customer.findMany({
    where: {
      id: { in: Array.from(flaggedCustomerIds) },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      BottleLedger: {
        where: {
          action: 'ISSUED',
          issuedDate: {
            lte: fiveDaysAgo,
          },
          penaltyAppliedAt: null,
        },
        orderBy: { issuedDate: 'asc' },
        take: 1,
      },
    },
  });

  const flaggedList = flaggedCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    oldestBottleDate: c.BottleLedger[0]?.issuedDate ?? null,
    daysOverdue: c.BottleLedger[0]?.issuedDate
      ? Math.floor((now.getTime() - new Date(c.BottleLedger[0].issuedDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));

  return {
    totalPendingRs: Math.round(totalPendingPaise / 100),
    collectedThisMonthRs: Math.round(collectedThisMonth / 100),
    flaggedCustomersCount: flaggedCustomerIds.size,
    flaggedCustomers: flaggedList,
    rules: [
      `Bottle not returned after ${PENALTY_THRESHOLD_DAYS} days: ₹${LARGE_BOTTLE_PENALTY_PAISE / 100} (1L), ₹${SMALL_BOTTLE_PENALTY_PAISE / 100} (500ml)`,
    ],
  };
}

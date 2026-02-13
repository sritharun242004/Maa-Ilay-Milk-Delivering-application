import { Router } from 'express';
import { isAuthenticated, isCustomer } from '../middleware/auth';
import prisma from '../config/prisma';
import { PRICING, calculateDailyPricePaise, DAILY_PRICE_MAP_RS, calculateDailyPriceRs } from '../config/pricing';
import {
  getNowIST,
  getStartOfDayIST,
  parseISTDateString,
  getCurrentHourIST,
  addDaysIST,
  toISTDateString,
  formatMonthYear,
  getDayOfWeek,
  toISOTimestamp
} from '../utils/dateUtils';
import { walletLimiter } from '../middleware/rateLimiter';
import {
  sanitizeCustomerProfile,
  sanitizeNotes,
  sanitizeSubscriptionData,
  sanitizeNumber,
  sanitizeDateString
} from '../utils/sanitize';
import {
  PAUSE_CUTOFF_HOUR,
  PAYMENT_DAY,
  QUANTITY,
  BOTTLES,
  PAYMENT
} from '../config/constants';
import { ErrorCode, createErrorResponse, getErrorMessage } from '../utils/errorCodes';

const router = Router();

/**
 * Subscription status for dashboard: ACTIVE, PAUSED, or INACTIVE
 * - PAUSED: User has manually paused deliveries
 * - INACTIVE: Insufficient wallet balance for next delivery
 * - ACTIVE: Has balance and not paused
 */
function subscriptionStatusDisplay(
  balanceRs: number,
  dailyRs: number,
  isPaused: boolean
): 'ACTIVE' | 'INACTIVE' | 'PAUSED' {
  if (isPaused) return 'PAUSED';
  return balanceRs >= dailyRs ? 'ACTIVE' : 'INACTIVE';
}

/** Next payment date (5th of next month, or 5th of current month if today < 5) */
function getNextPaymentDate(now: Date): { date: Date; year: number; month: number } {
  const day = now.getDate();
  if (day < PAYMENT_DAY) {
    return {
      date: new Date(now.getFullYear(), now.getMonth(), PAYMENT_DAY),
      year: now.getFullYear(),
      month: now.getMonth(),
    };
  }
  const next = new Date(now.getFullYear(), now.getMonth() + 1, PAYMENT_DAY);
  return {
    date: next,
    year: next.getFullYear(),
    month: next.getMonth(),
  };
}

/** Days in month (1-indexed month 1-12) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}


// Complete customer profile (onboarding) — saves all form data to DB
router.post('/complete-profile', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        getErrorMessage(ErrorCode.UNAUTHORIZED)
      ));
    }

    // Sanitize and validate all input
    const sanitized = sanitizeCustomerProfile(req.body);

    // Persist to database — updates the customer record created at Google sign-in
    // Status: VISITOR (user completed profile but hasn't subscribed yet)
    const customer = await prisma.customer.update({
      where: { id: req.user.id },
      data: {
        ...sanitized,
        status: 'VISITOR',
      },
    });

    res.json({
      success: true,
      message: 'Profile completed successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        status: customer.status,
      },
    });
  } catch (error: any) {
    console.error('Profile completion error:', error);

    // Handle unique constraint violation (phone already exists)
    if (error.code === 'P2002') {
      return res.status(400).json(createErrorResponse(
        ErrorCode.CUSTOMER_ALREADY_EXISTS,
        'Phone number already registered'
      ));
    }

    res.status(500).json(createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to complete profile',
      { originalError: error.message }
    ));
  }
});

// Update customer profile (name, phone, address)
router.patch('/profile', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Sanitize and validate all input
    const sanitized = sanitizeCustomerProfile(req.body);

    // Update customer record
    const customer = await prisma.customer.update({
      where: { id: req.user.id },
      data: sanitized,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: {
          line1: customer.addressLine1,
          line2: customer.addressLine2,
          landmark: customer.landmark,
          city: customer.city,
          pincode: customer.pincode,
        },
        status: customer.status,
      },
    });
  } catch (error: any) {
    console.error('Profile update error:', error);

    // Handle unique constraint violation (phone already exists)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already registered to another account' });
    }

    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get customer dashboard data (wallet, subscription, next delivery, pause days from DB)
router.get('/dashboard', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      include: {
        Subscription: true,
        DeliveryPerson: { select: { name: true, phone: true } },
        Wallet: {
          include: {
            WalletTransaction: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        Pause: {
          where: {
            pauseDate: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lte: tomorrow, // Include up to tomorrow
            },
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const walletBalancePaise = customer.Wallet?.balancePaise ?? 0;
    const walletBalanceRs = Number((walletBalancePaise / 100).toFixed(2));
    const sub = customer.Subscription;
    const pauseDaysUsed = sub?.pauseDaysUsedThisMonth ?? customer.Pause?.length ?? 0;

    // Next payment: 5th of every month; amount = full month days × daily rate (Rs only)
    const dailyQuantityMl = sub?.dailyQuantityMl ?? 1000;
    const { date: nextPaymentDateObj, year, month } = getNextPaymentDate(now);
    const daysInNextMonth = daysInMonth(year, month);
    const dailyRs = calculateDailyPriceRs(dailyQuantityMl);
    const nextPaymentAmountRs = (daysInNextMonth * dailyRs).toFixed(2);
    const nextPaymentMonthName = formatMonthYear(nextPaymentDateObj);

    // Check if tomorrow is paused
    const tomorrowDateStr = toISTDateString(tomorrow);
    const isTomorrowPaused = customer.Pause?.some(
      pause => toISTDateString(pause.pauseDate) === tomorrowDateStr
    ) ?? false;

    // Subscription status logic:
    // - If customer is PENDING_APPROVAL (no delivery person assigned) → null (show waiting message)
    // - If no delivery person assigned → null
    // - If tomorrow is paused → PAUSED
    // - If insufficient balance → INACTIVE
    // - Otherwise → ACTIVE
    const hasDeliveryPerson = !!customer.deliveryPersonId;
    const isPendingApproval = customer.status === 'PENDING_APPROVAL';

    const subscriptionStatusDisplayValue = sub && hasDeliveryPerson && !isPendingApproval
      ? subscriptionStatusDisplay(walletBalanceRs, dailyRs, isTomorrowPaused)
      : null;
    const balanceCoversDays = sub ? Math.floor(walletBalanceRs / dailyRs) : 0;

    // Next delivery: only show when subscription is truly active
    let nextDeliveryDate: string | null = null;
    if (subscriptionStatusDisplayValue === 'ACTIVE') {
      // Check if deliveries have started (respect deliveryStartDate)
      if (customer.deliveryStartDate) {
        const startDate = new Date(customer.deliveryStartDate);
        const tomorrowDate = new Date(tomorrow);
        if (tomorrowDate >= startDate) {
          // Deliveries have started, show tomorrow
          nextDeliveryDate = tomorrowDateStr;
        } else {
          // Deliveries haven't started yet, show the start date
          nextDeliveryDate = toISTDateString(startDate);
        }
      } else {
        // No start date set, deliveries can start anytime
        nextDeliveryDate = tomorrowDateStr;
      }
    }

    // FIX: Use lowercase 'subscription' for frontend compatibility
    res.set('Cache-Control', 'private, max-age=15');
    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: {
          line1: customer.addressLine1,
          line2: customer.addressLine2,
          landmark: customer.landmark,
          city: customer.city,
          pincode: customer.pincode,
        },
        status: customer.status,
        approvedAt: customer.approvedAt,
        createdAt: customer.createdAt,
        deliveryPerson: customer.DeliveryPerson
          ? { name: customer.DeliveryPerson.name, phone: customer.DeliveryPerson.phone }
          : null,
        walletBalanceRs: walletBalanceRs.toFixed(2),
      },
      subscription: sub
        ? {
          id: sub.id,
          status: sub.status,
          subscriptionStatusDisplay: subscriptionStatusDisplayValue,
          dailyQuantityMl: sub.dailyQuantityMl,
          dailyPricePaise: sub.dailyPricePaise,
          dailyPriceRs: (sub.dailyPricePaise / 100).toFixed(2),
          largeBotles: sub.largeBotles,
          smallBottles: sub.smallBottles,
          currentCycleStart: sub.currentCycleStart,
          deliveryCount: sub.deliveryCount,
          lastDepositAtDelivery: sub.lastDepositAtDelivery,
          pauseDaysUsedThisMonth: sub.pauseDaysUsedThisMonth,
          pauseMonthYear: sub.pauseMonthYear,
        }
        : null,
      nextPayment: {
        date: toISTDateString(nextPaymentDateObj),
        dateDisplay: `${PAYMENT_DAY} ${nextPaymentMonthName}`,
        amountRs: nextPaymentAmountRs,
        days: daysInNextMonth,
        description: `${daysInNextMonth} days (${nextPaymentMonthName})`,
      },
      nextDelivery: nextDeliveryDate
        ? { deliveryDate: nextDeliveryDate }
        : null,
      balanceCoversDays,
      pauseDaysUsed,
      recentTransactions: customer.Wallet?.WalletTransaction ?? [],
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get wallet balance + full transaction list
router.get('/wallet', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      include: {
        Wallet: {
          include: {
            WalletTransaction: { orderBy: { createdAt: 'desc' }, take: 50 },
          },
        },
      },
    });
    if (!customer?.Wallet) {
      return res.json({
        balancePaise: 0,
        balanceRs: '0.00',
        lastTransactionAt: null,
        transactions: [],
      });
    }
    const w = customer.Wallet;
    const lastTxn = w.WalletTransaction[0] ?? null;
    res.json({
      balancePaise: w.balancePaise,
      balanceRs: (w.balancePaise / 100).toFixed(2),
      lastTransactionAt: lastTxn?.createdAt ?? null,
      transactions: w.WalletTransaction.map((t) => ({
        id: t.id,
        type: t.type,
        amountPaise: t.amountPaise,
        amountRs: (Math.abs(t.amountPaise) / 100).toFixed(2),
        balanceAfterPaise: t.balanceAfterPaise,
        balanceAfterRs: (t.balanceAfterPaise / 100).toFixed(2),
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    console.error('Wallet error:', e);
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

// Add money to wallet (Top-up)
router.post('/wallet/topup', walletLimiter, isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json(createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      getErrorMessage(ErrorCode.UNAUTHORIZED)
    ));

    // Validate amount
    const amountRs = sanitizeNumber(req.body.amountRs, {
      min: PAYMENT.MIN_AMOUNT_RS,
      max: PAYMENT.MAX_AMOUNT_RS
    });

    if (amountRs < 10) {
      return res.status(400).json(createErrorResponse(
        ErrorCode.INVALID_AMOUNT,
        getErrorMessage(ErrorCode.INVALID_AMOUNT)
      ));
    }

    const amountPaise = Math.round(amountRs * 100);
    const customerId = req.user.id;

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { customerId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { customerId, balancePaise: 0 }
      });
    }

    const newBalancePaise = wallet.balancePaise + amountPaise;
    const wasNegative = wallet.balancePaise < 0;
    const isNowPositive = newBalancePaise >= 0;

    // Update wallet and create transaction in a transaction (database transaction)
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePaise: newBalancePaise,
          // FIX: Clear negativeBalanceSince when wallet becomes positive again
          negativeBalanceSince: (wasNegative && isNowPositive) ? null : wallet.negativeBalanceSince
        }
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WALLET_TOPUP',
          amountPaise: amountPaise,
          balanceAfterPaise: newBalancePaise,
          description: `Wallet top-up of ₹${amountRs}`,
          referenceType: 'payment',
          referenceId: `TOPUP_${Date.now()}`
        }
      })
    ]);

    // Update customer status after wallet top-up (might move from INACTIVE to ACTIVE)
    try {
      const { updateCustomerStatus } = await import('../utils/statusManager');
      await updateCustomerStatus(customerId);
    } catch (e) {
      console.error('Status update error after topup:', e);
      // Don't fail the request if status update fails
    }

    res.json({
      success: true,
      message: 'Money added successfully!',
      Wallet: {
        balancePaise: newBalancePaise,
        balanceRs: (newBalancePaise / 100).toFixed(2)
      }
    });

  } catch (e) {
    console.error('Wallet topup error:', e);
    res.status(500).json({ error: 'Failed to add money to wallet' });
  }
});

// Start/Update Subscription - Only manages daily quantity, no payment
// Payment is handled separately via wallet top-up
router.post('/subscribe', walletLimiter, isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Validate daily quantity
    const dailyQuantityMl = sanitizeNumber(req.body.dailyQuantityMl, {
      min: QUANTITY.MIN_ML,
      max: QUANTITY.MAX_ML,
      integer: true
    });

    // Calculate daily price using pricing map (includes volume discounts)
    const dailyPricePaise = calculateDailyPricePaise(dailyQuantityMl);

    const customerId = req.user.id;
    const now = new Date();

    // Ensure wallet exists (don't add money, just create if missing)
    let wallet = await prisma.wallet.findUnique({ where: { customerId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { customerId, balancePaise: 0 }
      });
    }

    // Calculate minimum required balance: bottle deposit + 3 days milk
    const { calculateBottleDepositPaise } = await import('../config/pricing');
    const depositRequired = calculateBottleDepositPaise(dailyQuantityMl);
    const minimumBalance = depositRequired + (dailyPricePaise * 3); // Deposit + 3 days milk

    // Check if user has sufficient balance
    const hasInsufficientBalance = wallet.balancePaise < minimumBalance;

    // If insufficient balance, reject subscription
    if (hasInsufficientBalance) {
      return res.status(400).json(createErrorResponse(
        ErrorCode.INSUFFICIENT_BALANCE,
        `Insufficient wallet balance. Please add ₹${(minimumBalance / 100).toFixed(2)} to subscribe (includes bottle deposit ₹${(depositRequired / 100).toFixed(2)} + 3 days milk).`,
        {
          required: minimumBalance / 100,
          available: wallet.balancePaise / 100,
          shortfall: (minimumBalance - wallet.balancePaise) / 100,
          breakdown: {
            deposit: depositRequired / 100,
            threeDaysMilk: (dailyPricePaise * 3) / 100
          }
        }
      ));
    }

    // Create or update subscription (ongoing - no end date)
    const subscription = await prisma.subscription.upsert({
      where: { customerId },
      update: {
        dailyQuantityMl,
        dailyPricePaise,
        largeBotles: Math.floor(dailyQuantityMl / 1000),
        smallBottles: (dailyQuantityMl % 1000) >= 500 ? 1 : 0,
        status: 'ACTIVE',
        // Keep existing start date if updating, use now if creating
      },
      create: {
        customerId,
        dailyQuantityMl,
        dailyPricePaise,
        largeBotles: Math.floor(dailyQuantityMl / 1000),
        smallBottles: (dailyQuantityMl % 1000) >= 500 ? 1 : 0,
        status: 'ACTIVE',
        startDate: now,
        // No end date - subscription is ongoing
        endDate: null,
        currentCycleStart: now,
        deliveryCount: 0,
        lastDepositAtDelivery: 0
      }
    });

    // Update customer status from VISITOR to PENDING_APPROVAL when they subscribe
    // They'll move to ACTIVE when admin assigns delivery person
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (customer && customer.status === 'VISITOR') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { status: 'PENDING_APPROVAL' }
      });
    }

    res.json({
      success: true,
      message: 'Subscription updated successfully!',
      Subscription: {
        dailyQuantityMl: subscription.dailyQuantityMl,
        dailyPriceRs: (subscription.dailyPricePaise / 100).toFixed(2),
        status: subscription.status
      }
    });

  } catch (e) {
    console.error('Subscription error:', e);
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

// Get calendar data: pause days + paused dates + delivery status per date (from DB only)
// Same concept as History: DELIVERED / PAUSED / NOT_DELIVERED per date
// Query: ?year=2026&month=0 (month 0-based, Jan=0)
router.get('/calendar', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const now = new Date();
    const year = Number(req.query.year) || now.getUTCFullYear();
    const month = Number(req.query.month) >= 0 ? Number(req.query.month) : now.getUTCMonth();

    // UTC month boundaries
    const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const customerId = req.user.id;
    const [customer, deliveries, modifications] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          Subscription: true,
          Pause: {
            where: { pauseDate: { gte: firstDay, lte: lastDay } },
            orderBy: { pauseDate: 'asc' },
          },
        },
      }),
      prisma.delivery.findMany({
        where: {
          customerId,
          deliveryDate: { gte: firstDay, lte: lastDay },
        },
        select: { deliveryDate: true, status: true },
      }),
      prisma.deliveryModification.findMany({
        where: {
          customerId,
          date: { gte: firstDay, lte: lastDay },
        },
      }),
    ]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Always use the actual count from the current month view
    const pauseDaysUsed = customer.Pause.length;

    // Timezone agnostic formatter
    const formatDate = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const pausedDates = customer.Pause.map((p) => formatDate(p.pauseDate));

    const modificationsByDate: Record<string, any> = {};
    for (const m of modifications) {
      const dateStr = formatDate(m.date);
      modificationsByDate[dateStr] = {
        quantityMl: m.quantityMl,
        largeBottles: m.largeBottles,
        smallBottles: m.smallBottles,
        notes: m.notes
      };
    }

    const deliveryStatusByDate: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED' | 'SCHEDULED'> = {};
    for (const d of deliveries) {
      const dateStr = formatDate(d.deliveryDate);
      const status = d.status;
      if (status === 'DELIVERED' || status === 'NOT_DELIVERED') {
        deliveryStatusByDate[dateStr] = status;
      } else {
        deliveryStatusByDate[dateStr] = (status === 'PAUSED' || status === 'BLOCKED' || status === 'HOLIDAY') ? 'PAUSED' : 'SCHEDULED';
      }
    }
    res.json({
      pauseDaysUsed,
      pausedDates,
      modificationsByDate,
      deliveryStatusByDate,
      year,
      month,
      currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      pauseCutoffHour: PAUSE_CUTOFF_HOUR,
      pauseCutoffMessage: 'To modify tomorrow\'s delivery, you must do it before 5:00 PM today. At or after 5 PM, you can only make changes from the day after tomorrow onwards.',
      baseQuantityMl: customer.Subscription?.dailyQuantityMl ?? 1000,
    });
  } catch (e) {
    console.error('Calendar error:', e);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// Create or Update a quantity modification (Extra/Reduce)
router.post('/calendar/modify', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Sanitize and validate inputs
    const date = sanitizeDateString(req.body.date);
    const quantityMl = sanitizeNumber(req.body.quantityMl, { min: QUANTITY.MIN_ML, max: QUANTITY.MAX_ML, integer: true });
    const largeBottles = sanitizeNumber(req.body.largeBottles, { min: BOTTLES.MIN_PER_DELIVERY, max: BOTTLES.MAX_PER_DELIVERY, integer: true });
    const smallBottles = sanitizeNumber(req.body.smallBottles, { min: BOTTLES.MIN_PER_DELIVERY, max: BOTTLES.MAX_PER_DELIVERY, integer: true });
    const notes = req.body.notes ? sanitizeNotes(req.body.notes) : null;

    // Parse date in IST timezone
    const modDate = getStartOfDayIST(parseISTDateString(date));

    // Upsert modification
    await prisma.deliveryModification.upsert({
      where: {
        customerId_date: {
          customerId: req.user.id,
          date: modDate
        }
      },
      create: {
        customerId: req.user.id,
        date: modDate,
        quantityMl,
        largeBottles,
        smallBottles,
        notes
      },
      update: {
        quantityMl,
        largeBottles,
        smallBottles,
        notes
      }
    });

    // If today or future, update existing SCHEDULED delivery if any
    await prisma.delivery.updateMany({
      where: {
        customerId: req.user.id,
        deliveryDate: modDate,
        status: 'SCHEDULED'
      },
      data: {
        quantityMl,
        largeBottles,
        smallBottles,
        deliveryNotes: notes
      }
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Modify delivery error:', e);
    res.status(500).json({ error: 'Failed to modify delivery' });
  }
});

// Remove a quantity modification
router.delete('/calendar/modify', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const dateStr = String(req.query.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    // Parse date in IST timezone
    const modDate = getStartOfDayIST(parseISTDateString(dateStr));

    await prisma.deliveryModification.deleteMany({
      where: {
        customerId: req.user.id,
        date: modDate
      }
    });

    // Revert existing SCHEDULED delivery to base subscription values
    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      include: { Subscription: true }
    });

    if (customer?.Subscription) {
      const sub = customer.Subscription;
      await prisma.delivery.updateMany({
        where: {
          customerId: req.user.id,
          deliveryDate: modDate,
          status: 'SCHEDULED'
        },
        data: {
          quantityMl: sub.dailyQuantityMl,
          largeBottles: sub.largeBotles ?? (sub.dailyQuantityMl >= 1000 ? Math.floor(sub.dailyQuantityMl / 1000) : 0),
          smallBottles: sub.smallBottles ?? (sub.dailyQuantityMl % 1000 >= 500 ? 1 : 0),
          deliveryNotes: null
        }
      });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Delete modification error:', e);
    res.status(500).json({ error: 'Failed to remove modification' });
  }
});

// Add a pause date (saves to DB, updates Delivery to PAUSED for that date)
router.post('/calendar/pause', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Sanitize and validate date
    const dateStr = sanitizeDateString(req.body.date);

    // Parse date in IST timezone
    const pauseDate = getStartOfDayIST(parseISTDateString(dateStr));
    const now = getNowIST();
    const todayStart = getStartOfDayIST(now);
    if (pauseDate < todayStart) {
      return res.status(400).json({ error: 'Cannot pause a past date' });
    }
    // To pause TOMORROW, request must be before TODAY 5 PM
    // Business rule: Can pause before 5:00 PM (17:00), blocked at or after 5:00 PM (>= 17:00)
    const tomorrowStart = getStartOfDayIST(addDaysIST(now, 1));
    if (pauseDate.getTime() === tomorrowStart.getTime()) {
      const currentHour = getCurrentHourIST();
      if (currentHour >= PAUSE_CUTOFF_HOUR) {
        return res.status(400).json(createErrorResponse(
          ErrorCode.CUTOFF_TIME_EXCEEDED,
          'To pause tomorrow, you must pause before 5:00 PM today. You can only pause from the day after tomorrow onward.',
          { cutoff: '17:00' }
        ));
      }
    }
    const customerId = req.user.id;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { Subscription: true },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // No pause limit - customers can pause unlimited days
    await prisma.pause.upsert({
      where: {
        customerId_pauseDate: { customerId, pauseDate },
      },
      create: { customerId, pauseDate, createdByCustomer: true },
      update: {},
    });
    await prisma.delivery.updateMany({
      where: { customerId, deliveryDate: pauseDate },
      data: { status: 'PAUSED' },
    });
    res.json({ success: true, date: dateStr });
  } catch (e) {
    console.error('Add pause error:', e);
    res.status(500).json({ error: 'Failed to add pause' });
  }
});

// Remove a pause date (from DB, set Delivery back to SCHEDULED)
router.delete('/calendar/pause', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Sanitize and validate date
    const dateStr = sanitizeDateString(req.query.date as string);

    // Parse date in IST timezone
    const pauseDate = getStartOfDayIST(parseISTDateString(dateStr));
    const customerId = req.user.id;
    await prisma.pause.deleteMany({
      where: { customerId, pauseDate },
    });
    await prisma.delivery.updateMany({
      where: { customerId, deliveryDate: pauseDate },
      data: { status: 'SCHEDULED' },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { Subscription: true },
    });
    const sub = customer?.Subscription;
    if (sub && (sub.pauseDaysUsedThisMonth ?? 0) > 0) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { pauseDaysUsedThisMonth: Math.max(0, (sub.pauseDaysUsedThisMonth ?? 1) - 1) },
      });
    }
    res.json({ success: true, date: dateStr });
  } catch (e) {
    console.error('Remove pause error:', e);
    res.status(500).json({ error: 'Failed to remove pause' });
  }
});

// Get delivery history (past deliveries)
router.get('/history/deliveries', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    const deliveries = await prisma.delivery.findMany({
      where: {
        customerId: req.user.id,
        deliveryDate: { lt: tomorrowStart }
      },
      orderBy: { deliveryDate: 'desc' },
      take: limit,
      include: { DeliveryPerson: true },
    });

    const list = deliveries.map((d) => {
      let statusDisplay: 'delivered' | 'not-delivered' | 'paused' | 'pending' = 'pending';
      if (d.status === 'DELIVERED') statusDisplay = 'delivered';
      else if (d.status === 'NOT_DELIVERED') statusDisplay = 'not-delivered';
      else if (['PAUSED', 'BLOCKED', 'HOLIDAY'].includes(d.status)) statusDisplay = 'paused';
      else if (d.status === 'SCHEDULED') statusDisplay = 'pending';

      const dDate = d.deliveryDate;
      const y = dDate.getFullYear();
      const m = String(dDate.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;

      return {
        id: d.id,
        date: dateStr,
        day: getDayOfWeek(dDate),
        quantityMl: d.quantityMl,
        quantity: d.quantityMl === 1000 ? '1L' : '500ml',
        status: statusDisplay,
        person: d.DeliveryPerson?.name ?? '—',
        remarks: d.deliveryNotes ?? '',
      };
    });
    res.json({ deliveries: list });
  } catch (e) {
    console.error('History deliveries error:', e);
    res.status(500).json({ error: 'Failed to load delivery history' });
  }
});

// Get bottle ledger + totals
router.get('/history/bottles', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const entries = await prisma.bottleLedger.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    let totalIssued1L = 0;
    let totalIssued500ml = 0;
    let totalReturned1L = 0;
    let totalReturned500ml = 0;
    for (const e of entries) {
      if (e.action === 'ISSUED') {
        if (e.size === 'LARGE') totalIssued1L += e.quantity;
        else totalIssued500ml += e.quantity;
      } else if (e.action === 'RETURNED') {
        if (e.size === 'LARGE') totalReturned1L += e.quantity;
        else totalReturned500ml += e.quantity;
      }
    }
    const last = entries[0];
    const withCustomer1L = last?.largeBottleBalanceAfter ?? 0;
    const withCustomer500ml = last?.smallBottleBalanceAfter ?? 0;
    const list = entries.reverse().map((e) => ({
      id: e.id,
      date: toISTDateString(e.createdAt),
      type: e.action === 'ISSUED' ? 'issued' : e.action === 'RETURNED' ? 'collected' : 'penalty',
      bottles1L: e.size === 'LARGE' ? e.quantity : 0,
      bottles500ml: e.size === 'SMALL' ? e.quantity : 0,
      balance: e.largeBottleBalanceAfter + e.smallBottleBalanceAfter,
    }));
    res.json({
      totalIssued: totalIssued1L + totalIssued500ml,
      totalCollected: totalReturned1L + totalReturned500ml,
      withCustomer: withCustomer1L + withCustomer500ml,
      entries: list,
    });
  } catch (e) {
    console.error('History bottles error:', e);
    res.status(500).json({ error: 'Failed to load bottle ledger' });
  }
});

// Bulk update (Pause, Modify, or Resume)
router.post('/calendar/bulk', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Sanitize and validate inputs
    const dates = req.body.dates;
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'No dates provided' });
    }

    // Validate action
    const allowedActions = ['pause', 'modify', 'resume'] as const;
    const action = req.body.action;
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Sanitize quantity fields if action is 'modify'
    let quantityMl, largeBottles, smallBottles, notes;
    if (action === 'modify') {
      quantityMl = sanitizeNumber(req.body.quantityMl, { min: QUANTITY.MIN_ML, max: QUANTITY.MAX_ML, integer: true });
      largeBottles = sanitizeNumber(req.body.largeBottles, { min: BOTTLES.MIN_PER_DELIVERY, max: BOTTLES.MAX_PER_DELIVERY, integer: true });
      smallBottles = sanitizeNumber(req.body.smallBottles, { min: BOTTLES.MIN_PER_DELIVERY, max: BOTTLES.MAX_PER_DELIVERY, integer: true });
      notes = req.body.notes ? sanitizeNotes(req.body.notes) : null;
    }

    const customerId = req.user.id;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { Subscription: true }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const now = new Date();
    // Today boundary in UTC for past checks
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    for (const dateStr of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
      const [y, m, d] = dateStr.split('-').map(Number);

      const targetDateUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      const dayEndUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

      // Check past dates
      if (targetDateUTC < todayUTC) continue;

      // FIX: Check 5 PM cutoff for tomorrow using IST timezone
      const tomorrowUTC = new Date(todayUTC);
      tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

      if (targetDateUTC.getTime() === tomorrowUTC.getTime()) {
        // FIX: Use IST-aware hour check instead of local timezone
        const currentHourIST = getCurrentHourIST();
        if (currentHourIST >= PAUSE_CUTOFF_HOUR) {
          const actionText = action === 'pause' ? 'pause' : action === 'resume' ? 'resume' : 'modify';
          return res.status(400).json({
            error: `Cannot ${actionText} tomorrow's delivery at or after 5 PM. You can make changes from day after tomorrow onwards.`
          });
        }
      }

      if (action === 'pause') {
        // No pause limit - customers can pause unlimited days
        // Range delete first to clear any old format dates or IST shifted dates
        await prisma.pause.deleteMany({
          where: { customerId, pauseDate: { gte: targetDateUTC, lte: dayEndUTC } }
        });
        await prisma.pause.create({
          data: { customerId, pauseDate: targetDateUTC, createdByCustomer: true }
        });

        await prisma.delivery.updateMany({
          where: { customerId, deliveryDate: { gte: targetDateUTC, lte: dayEndUTC }, status: 'SCHEDULED' },
          data: { status: 'PAUSED' },
        });
      } else if (action === 'modify') {
        // Ensure modification fields are defined
        if (quantityMl === undefined || largeBottles === undefined || smallBottles === undefined) {
          return res.status(400).json({ error: 'Missing modification details' });
        }

        // Save the modification (Primary source of truth for list generation)
        await prisma.deliveryModification.deleteMany({
          where: { customerId, date: { gte: targetDateUTC, lte: dayEndUTC } }
        });
        await prisma.deliveryModification.create({
          data: { customerId, date: targetDateUTC, quantityMl, largeBottles, smallBottles, notes: notes ?? null },
        });

        // Aggressively update any existing delivery rows
        await prisma.delivery.updateMany({
          where: { customerId, deliveryDate: targetDateUTC },
          data: {
            quantityMl,
            largeBottles,
            smallBottles,
            deliveryNotes: notes ?? null,
            chargePaise: calculateDailyPricePaise(quantityMl)
          },
        });
      } else if (action === 'resume') {
        await prisma.pause.deleteMany({
          where: { customerId, pauseDate: { gte: targetDateUTC, lte: dayEndUTC } },
        });
        await prisma.deliveryModification.deleteMany({
          where: { customerId, date: { gte: targetDateUTC, lte: dayEndUTC } },
        });

        if (customer.Subscription) {
          const sub = customer.Subscription;
          const quantityMl = sub.dailyQuantityMl;
          await prisma.delivery.updateMany({
            where: { customerId, deliveryDate: targetDateUTC, status: { in: ['PAUSED', 'SCHEDULED'] } },
            data: {
              status: 'SCHEDULED',
              quantityMl: quantityMl,
              largeBottles: sub.largeBotles ?? (quantityMl >= 1000 ? Math.floor(quantityMl / 1000) : 0),
              smallBottles: sub.smallBottles ?? (quantityMl % 1000 >= 500 ? 1 : 0),
              deliveryNotes: null,
              chargePaise: calculateDailyPricePaise(quantityMl)
            },
          });
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Bulk calendar error:', e);
    res.status(500).json({ error: 'Failed to apply bulk changes' });
  }
});

// Get pause history (recent pauses for undo feature)
router.get('/pause-history', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pauses = await prisma.pause.findMany({
      where: {
        customerId: req.user.id,
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        pauseDate: true,
        createdAt: true
      }
    });

    const history = pauses.map(p => ({
      date: toISTDateString(p.pauseDate),
      pausedAt: toISOTimestamp(p.createdAt)
    }));

    res.json(history);
  } catch (e) {
    console.error('Pause history error:', e);
    res.status(500).json({ error: 'Failed to load pause history' });
  }
});

export default router;

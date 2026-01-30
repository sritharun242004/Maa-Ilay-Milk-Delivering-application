import { Router } from 'express';
import { isAuthenticated, isCustomer } from '../middleware/auth';
import prisma from '../config/prisma';
import { PRICING } from '../config/pricing';

const router = Router();

const PAYMENT_DAY = PRICING.PAYMENT_DAY;
/** To pause TOMORROW, customer must pause by TODAY 5:00 PM (My Life rule). */
const PAUSE_CUTOFF_HOUR = 17;

/** Subscription status for dashboard: only Active or Inactive. Active when balance >= 1 day's milk charge (tomorrow's delivery); Inactive when below. */
function subscriptionStatusDisplay(balanceRs: number, dailyRs: number): 'ACTIVE' | 'INACTIVE' {
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
    const raw = req.body;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const phone = typeof raw.phone === 'string' ? raw.phone.trim().replace(/\s/g, '') : '';
    const addressLine1 = typeof raw.addressLine1 === 'string' ? raw.addressLine1.trim() : '';
    const addressLine2 = typeof raw.addressLine2 === 'string' ? raw.addressLine2.trim() || null : null;
    const landmark = typeof raw.landmark === 'string' ? raw.landmark.trim() || null : null;
    const city = typeof raw.city === 'string' ? raw.city.trim() || 'Pondicherry' : 'Pondicherry';
    const pincode = typeof raw.pincode === 'string' ? raw.pincode.trim() : '';

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Name is required (at least 2 characters)' });
    }
    if (!phone || !addressLine1 || !pincode) {
      return res.status(400).json({ error: 'Phone, address, and pincode are required' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone must be 10 digits' });
    }
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Pincode must be 6 digits' });
    }

    // Persist to database — updates the customer record created at Google sign-in
    const customer = await prisma.customer.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
        addressLine1,
        addressLine2,
        landmark,
        city,
        pincode,
        status: 'PENDING_APPROVAL',
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
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// Get customer dashboard data (wallet, subscription, next delivery, pause days from DB)
router.get('/dashboard', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      include: {
        subscription: true,
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        pauses: {
          where: {
            pauseDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
            },
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const walletBalancePaise = customer.wallet?.balancePaise ?? 0;
    const walletBalanceRs = Number((walletBalancePaise / 100).toFixed(2));
    const sub = customer.subscription;
    const pauseDaysUsed = sub?.pauseDaysUsedThisMonth ?? customer.pauses?.length ?? 0;

    // Next payment: 5th of every month; amount = full month days × daily rate (Rs only)
    const now = new Date();
    const dailyQuantityMl = sub?.dailyQuantityMl ?? 1000;
    const { date: nextPaymentDateObj, year, month } = getNextPaymentDate(now);
    const daysInNextMonth = daysInMonth(year, month);
    const dailyRs = dailyQuantityMl >= 1000 ? PRICING.DAILY_1L_RS : PRICING.DAILY_500ML_RS;
    const nextPaymentAmountRs = (daysInNextMonth * dailyRs).toFixed(2);
    const nextPaymentMonthName = nextPaymentDateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Subscription: Active when balance >= 1 day's charge (tomorrow's delivery); Inactive when below. Next delivery = next day when Active.
    const subscriptionStatusDisplayValue = sub
      ? subscriptionStatusDisplay(walletBalanceRs, dailyRs)
      : null;
    const balanceCoversDays = sub ? Math.floor(walletBalanceRs / dailyRs) : 0;

    // Next delivery: next day when balance sufficient (Active); null when insufficient (Inactive).
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDeliveryDate =
      subscriptionStatusDisplayValue === 'ACTIVE'
        ? tomorrow.toISOString().slice(0, 10)
        : null;

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
          startDate: sub.startDate,
          endDate: sub.endDate,
          largeBotles: sub.largeBotles,
          smallBottles: sub.smallBottles,
          currentCycleStart: sub.currentCycleStart,
          paymentCycleCount: sub.paymentCycleCount,
          pauseDaysUsedThisMonth: sub.pauseDaysUsedThisMonth,
          pauseMonthYear: sub.pauseMonthYear,
        }
        : null,
      nextPayment: {
        date: nextPaymentDateObj.toISOString().slice(0, 10),
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
      recentTransactions: customer.wallet?.transactions ?? [],
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
        wallet: {
          include: {
            transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
          },
        },
      },
    });
    if (!customer?.wallet) {
      return res.json({
        balancePaise: 0,
        balanceRs: '0.00',
        lastTransactionAt: null,
        transactions: [],
      });
    }
    const w = customer.wallet;
    const lastTxn = w.transactions[0] ?? null;
    res.json({
      balancePaise: w.balancePaise,
      balanceRs: (w.balancePaise / 100).toFixed(2),
      lastTransactionAt: lastTxn?.createdAt ?? null,
      transactions: w.transactions.map((t) => ({
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

// Start Subscription - calculates amount, tops up wallet (mock), and creates/updates subscription
router.post('/subscribe', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { dailyQuantityMl, startDate, endDate, amountToPayRs } = req.body;

    if (!dailyQuantityMl || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing subscription details' });
    }

    // 1. Calculate daily rate (matching frontend logic)
    let dailyRs = 0;
    if (dailyQuantityMl === 500) dailyRs = PRICING.DAILY_500ML_RS;
    else if (dailyQuantityMl === 1000) dailyRs = PRICING.DAILY_1L_RS;
    else if (dailyQuantityMl === 1500) dailyRs = PRICING.DAILY_1L_RS + PRICING.DAILY_500ML_RS;
    else dailyRs = (dailyQuantityMl / 1000) * PRICING.DAILY_1L_RS;

    const dailyPricePaise = Math.round(dailyRs * 100);

    // 2. Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);

    // Use the amount passed from frontend (which is total - wallet)
    const amountPaise = typeof amountToPayRs === 'number'
      ? Math.round(amountToPayRs * 100)
      : 0;

    // 3. Update/Create Wallet and WalletTransaction
    const customerId = req.user.id;

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { customerId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { customerId, balancePaise: 0 }
      });
    }

    const newBalancePaise = wallet.balancePaise + amountPaise;

    await prisma.$transaction([
      // Update wallet balance
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: newBalancePaise }
      }),
      // Add transaction record
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WALLET_TOPUP',
          amountPaise: amountPaise,
          balanceAfterPaise: newBalancePaise,
          description: `Subscription payment for ${days} days (${dailyQuantityMl}ml/day)`,
          referenceType: 'payment',
          referenceId: `MOCK_${Date.now()}`
        }
      }),
      // Create/Update subscription
      prisma.subscription.upsert({
        where: { customerId },
        update: {
          dailyQuantityMl,
          dailyPricePaise,
          largeBotles: Math.floor(dailyQuantityMl / 1000),
          smallBottles: (dailyQuantityMl % 1000) >= 500 ? 1 : 0,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          currentCycleStart: start
        },
        create: {
          customerId,
          dailyQuantityMl,
          dailyPricePaise,
          largeBotles: Math.floor(dailyQuantityMl / 1000),
          smallBottles: (dailyQuantityMl % 1000) >= 500 ? 1 : 0,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          currentCycleStart: start,
          paymentCycleCount: 1
        }
      }),
      // Update customer status to ACTIVE if it was PENDING_APPROVAL or PENDING_PAYMENT
      prisma.customer.update({
        where: { id: customerId },
        data: { status: 'ACTIVE' }
      })
    ]);

    res.json({
      success: true,
      message: 'Subscription started successfully!',
      transaction: {
        amountRs: amountToPayRs,
        days,
        newBalanceRs: (newBalancePaise / 100).toFixed(2)
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
    const year = Number(req.query.year) ?? now.getFullYear();
    const month = Number(req.query.month) ?? now.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const customerId = req.user.id;
    const [customer, deliveries] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          subscription: true,
          pauses: {
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
    ]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const pauseDaysUsed = customer.subscription?.pauseDaysUsedThisMonth ?? customer.pauses.length;
    const pausedDates = customer.pauses.map((p) =>
      p.pauseDate.toISOString().slice(0, 10)
    );
    // Same date format as History (toISOString) so calendar blocks match History rows
    const deliveryStatusByDate: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED'> = {};
    for (const d of deliveries) {
      const dateStr = d.deliveryDate.toISOString().slice(0, 10);
      const status = d.status;
      if (status === 'DELIVERED' || status === 'NOT_DELIVERED') {
        deliveryStatusByDate[dateStr] = status;
      } else {
        // PAUSED, BLOCKED, HOLIDAY, SCHEDULED → show as PAUSED (orange) or NOT_DELIVERED (red)
        deliveryStatusByDate[dateStr] = status === 'PAUSED' || status === 'BLOCKED' || status === 'HOLIDAY' ? 'PAUSED' : 'NOT_DELIVERED';
      }
    }
    res.json({
      pauseDaysUsed,
      maxPauseDays: 5,
      pausedDates,
      deliveryStatusByDate,
      year,
      month,
      currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      pauseCutoffHour: PAUSE_CUTOFF_HOUR,
      pauseCutoffMessage: 'To pause tomorrow, you must pause by 5:00 PM today. After 5 PM, you can only pause from the day after tomorrow onward.',
    });
  } catch (e) {
    console.error('Calendar error:', e);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// Add a pause date (saves to DB, updates Delivery to PAUSED for that date)
router.post('/calendar/pause', isAuthenticated, isCustomer, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const dateStr = typeof req.body?.date === 'string' ? req.body.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date; use YYYY-MM-DD' });
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    const pauseDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    if (pauseDate < todayStart) {
      return res.status(400).json({ error: 'Cannot pause a past date' });
    }
    // To pause TOMORROW, request must be before TODAY 5 PM
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    if (pauseDate.getTime() === tomorrowStart.getTime()) {
      const cutoff = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate(), PAUSE_CUTOFF_HOUR, 0, 0, 0);
      if (now >= cutoff) {
        return res.status(400).json({
          error: 'To pause tomorrow, you must pause by 5:00 PM today. You can only pause from the day after tomorrow onward.',
          cutoff: '17:00',
        });
      }
    }
    const customerId = req.user.id;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { subscription: true },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const maxPause = 5;
    const py = pauseDate.getFullYear();
    const pm = pauseDate.getMonth();
    const monthStart = new Date(py, pm, 1, 0, 0, 0, 0);
    const monthEnd = new Date(py, pm + 1, 0, 23, 59, 59, 999);
    const countThisMonth = await prisma.pause.count({
      where: {
        customerId,
        pauseDate: { gte: monthStart, lte: monthEnd },
      },
    });
    if (countThisMonth >= maxPause) {
      return res.status(400).json({ error: `Maximum ${maxPause} pause days per month` });
    }
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
    const sub = customer.subscription;
    if (sub) {
      const newUsed = Math.min((sub.pauseDaysUsedThisMonth ?? 0) + 1, maxPause);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { pauseDaysUsedThisMonth: newUsed, pauseMonthYear: `${pauseDate.getFullYear()}-${String(pauseDate.getMonth() + 1).padStart(2, '0')}` },
      });
    }
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
    const dateStr = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date; use YYYY-MM-DD' });
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    const pauseDate = new Date(y, m - 1, d, 0, 0, 0, 0);
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
      include: { subscription: true },
    });
    const sub = customer?.subscription;
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
    const deliveries = await prisma.delivery.findMany({
      where: { customerId: req.user.id, deliveryDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
      orderBy: { deliveryDate: 'desc' },
      take: limit,
      include: { deliveryPerson: true },
    });
    const list = deliveries.map((d) => ({
      id: d.id,
      date: d.deliveryDate.toISOString().slice(0, 10),
      day: d.deliveryDate.toLocaleDateString('en-IN', { weekday: 'long' }),
      quantityMl: d.quantityMl,
      quantity: d.quantityMl === 1000 ? '1L' : '500ml',
      status: d.status === 'DELIVERED' ? 'delivered' : d.status === 'NOT_DELIVERED' ? 'not-delivered' : 'paused',
      person: d.deliveryPerson?.name ?? '—',
      remarks: d.deliveryNotes ?? '',
    }));
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
      date: e.createdAt.toISOString().slice(0, 10),
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

export default router;

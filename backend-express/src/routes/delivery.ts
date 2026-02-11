import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isAuthenticated, isDelivery } from '../middleware/auth';
import prisma from '../config/prisma';
import { calculateDailyPricePaise } from '../config/pricing';
import { MemoryCache } from '../lib/cache';

const assigneesCache = new MemoryCache();
import {
  getNowIST,
  getStartOfDayIST,
  getEndOfDayIST,
  parseISTDateString,
  toISTDateString,
  addDaysIST,
  getTodayRangeIST,
  toISOTimestamp,
  getDateRangeForDateColumn,
  getTodayRangeForDateColumn
} from '../utils/dateUtils';
import { deliveryActionLimiter } from '../middleware/rateLimiter';
import { sanitizeDeliveryData } from '../utils/sanitize';
import { ErrorCode, createErrorResponse, getErrorMessage } from '../utils/errorCodes';
import { updateCustomerStatus } from '../utils/statusManager';

const router = Router();

// Simple in-memory cache for ensureTodayDeliveries to avoid running on every request
const deliveryCache = new Map<string, Date>();

function getCacheKey(deliveryPersonId: string, date: Date): string {
  return `${deliveryPersonId}_${date.toISOString().split('T')[0]}`;
}

function isCacheValid(cacheKey: string): boolean {
  const cachedDate = deliveryCache.get(cacheKey);
  if (!cachedDate) return false;
  // Cache valid for 30 seconds (short TTL to prevent repeated calls while staying fresh)
  return Date.now() - cachedDate.getTime() < 30 * 1000;
}

// IST timezone-aware date functions for Pondicherry region
function todayStart() {
  return getStartOfDayIST();
}
function tomorrowStart() {
  return getStartOfDayIST(addDaysIST(getNowIST(), 1));
}

/**
 * Ensure Delivery rows exist for today for all customers who:
 * - Are assigned to this delivery person
 * - Have ACTIVE subscription
 * - Are NOT paused for today
 * - Have wallet balance >= 1 day's milk charge (paid)
 * Creates SCHEDULED Delivery rows if missing; does not overwrite existing rows.
 * OPTIMIZED: Uses cache to avoid running on every request.
 */
export async function ensureTodayDeliveries(deliveryPersonId: string, start: Date, end: Date): Promise<void> {
  // FIX: Re-enable cache with 30-second TTL to prevent repeated expensive queries
  const cacheKey = getCacheKey(deliveryPersonId, start);
  if (isCacheValid(cacheKey)) {
    return; // Already processed recently, skip
  }
  const [eligibleCustomers, existingDeliveries, modificationsForToday] = await Promise.all([
    prisma.customer.findMany({
      where: {
        deliveryPersonId,
        status: 'ACTIVE',
        Subscription: { status: 'ACTIVE' },
        Pause: { none: { pauseDate: { gte: start, lte: end } } },
      },
      include: { Subscription: true, Wallet: true },
    }),
    prisma.delivery.findMany({
      where: { deliveryPersonId, deliveryDate: { gte: start, lte: end } },
      select: { customerId: true },
    }),
    prisma.deliveryModification.findMany({
      where: { date: { gte: start, lte: end } },
    }),
  ]);

  const existingSet = new Set(existingDeliveries.map((d: any) => d.customerId));
  const modMap = new Map(modificationsForToday.map((m: any) => [m.customerId, m]));

  const newDeliveries = eligibleCustomers
    .filter((c) => {
      if (existingSet.has(c.id)) return false;
      const sub = c.Subscription;
      if (!sub) return false;

      // Check delivery start date set by admin (priority)
      // Both dates are stored at UTC midnight, so direct comparison works
      if (c.deliveryStartDate) {
        const customerStartDate = new Date(c.deliveryStartDate);
        // If customer's start date is AFTER the query date, don't create delivery
        if (customerStartDate > start) return false;
      }

      // Subscription start date check
      if (sub.startDate) {
        const subStartDate = new Date(sub.startDate);
        if (subStartDate > start) return false;
      }

      // Wallet balance check: negative balance = no delivery
      const balance = c.Wallet?.balancePaise ?? 0;
      if (balance < 0) return false; // Block if balance is negative

      return true;
    })
    .map((c) => {
      const sub = c.Subscription!;
      const mod = modMap.get(c.id);

      const quantityMl = mod ? mod.quantityMl : sub.dailyQuantityMl;
      const largeBottles = mod ? mod.largeBottles : (sub.largeBotles ?? (quantityMl >= 1000 ? Math.floor(quantityMl / 1000) : 0));
      const smallBottles = mod ? mod.smallBottles : (sub.smallBottles ?? (quantityMl % 1000 >= 500 ? 1 : 0));

      // Calculate price using central logic
      const chargePaise = calculateDailyPricePaise(quantityMl);

      return {
        customerId: c.id,
        deliveryPersonId,
        deliveryDate: start, // Save as UTC midnight
        quantityMl,
        largeBottles,
        smallBottles,
        chargePaise,
        depositPaise: 0,
        status: 'SCHEDULED' as const,
        deliveryNotes: mod?.notes || null,
      };
    });

  if (newDeliveries.length > 0) {
    // Race condition protection:
    // - skipDuplicates: true prevents duplicate key errors
    // - Database has unique constraint on [customerId, deliveryDate]
    // - If concurrent requests create same delivery, DB handles it gracefully
    await prisma.delivery.createMany({
      data: newDeliveries,
      skipDuplicates: true,
    });
  }

  // FIX: Re-enable cache with 30-second TTL
  deliveryCache.set(cacheKey, new Date());
}

// Current delivery person profile
router.get('/me', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const delivery = await prisma.deliveryPerson.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, phone: true },
    });
    if (!delivery) return res.status(404).json({ error: 'Not found' });
    res.json({ ...delivery, mustChangePassword: false });
  } catch (e) {
    console.error('Delivery me error:', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Change password (delivery person sets own password after one-time from admin)
router.put('/me/password', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const delivery = await prisma.deliveryPerson.findUnique({ where: { id: req.user.id } });
    if (!delivery) return res.status(404).json({ error: 'Not found' });

    const valid = await bcrypt.compare(currentPassword, delivery.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.deliveryPerson.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });
    res.json({ success: true, message: 'Password updated. You can continue.' });
  } catch (e) {
    console.error('Delivery change password error:', e);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// My assignees: full list of customers assigned to this delivery person (recent first)
router.get('/assignees', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Check cache (60s TTL per delivery person)
    const cacheKey = `assignees_${req.user.id}`;
    const cached = assigneesCache.get(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'private, max-age=60');
      return res.json(cached);
    }

    // Use UTC midnight for DATE column query
    const todayRange = getTodayRangeForDateColumn();

    const [customers, todaysDeliveries, todaysPauses] = await Promise.all([
      prisma.customer.findMany({
        where: { deliveryPersonId: req.user.id },
        include: {
          Subscription: { select: { dailyQuantityMl: true, dailyPricePaise: true } },
          Wallet: { select: { balancePaise: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.delivery.findMany({
        where: {
          deliveryPersonId: req.user.id,
          deliveryDate: { gte: todayRange.start, lte: todayRange.end },
        },
        select: { customerId: true, status: true },
      }),
      prisma.pause.findMany({
        where: {
          pauseDate: { gte: todayRange.start, lte: todayRange.end },
        },
        select: { customerId: true },
      }),
    ]);

    const deliveryMap = new Map(todaysDeliveries.map(d => [d.customerId, d.status]));
    const pausedCustomerIds = new Set(todaysPauses.map(p => p.customerId));

    const list = customers.map((c) => {
      // Compute display status for delivery person view
      let displayStatus: string;
      if (pausedCustomerIds.has(c.id)) {
        displayStatus = 'Paused';
      } else if (c.status === 'PENDING_APPROVAL') {
        displayStatus = 'Pending';
      } else if (c.Wallet && c.Subscription) {
        // Negative balance = inactive
        if (c.Wallet.balancePaise < 0) {
          displayStatus = 'Inactive';
        } else {
          displayStatus = 'Active';
        }
      } else if (!c.Subscription) {
        displayStatus = 'Pending';
      } else {
        displayStatus = c.status === 'ACTIVE' ? 'Active' : 'Inactive';
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: `${c.addressLine1}${c.addressLine2 ? ', ' + c.addressLine2 : ''}, ${c.pincode}`,
        plan: c.Subscription
          ? c.Subscription.dailyQuantityMl >= 1000
            ? `${c.Subscription.dailyQuantityMl / 1000}L`
            : `${c.Subscription.dailyQuantityMl}ml`
          : '—',
        status: c.status,
        displayStatus,
        hasDeliveryToday: deliveryMap.has(c.id),
        deliveryStatus: deliveryMap.get(c.id) || null,
      };
    });
    const result = { assignees: list };
    // Cache for 60 seconds
    assigneesCache.set(cacheKey, result, 60_000);
    res.set('Cache-Control', 'private, max-age=60');
    res.json(result);
  } catch (e) {
    console.error('Delivery assignees error:', e);
    res.status(500).json({ error: 'Failed to load assignees' });
  }
});

// Deliveries for a given day (query ?date=YYYY-MM-DD; default today)
router.get('/today', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const dateParam = req.query.date as string | undefined;
    let start: Date;
    let end: Date;
    let dateStr: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      // Use the date string directly for DATE column queries
      dateStr = dateParam;
      const range = getDateRangeForDateColumn(dateParam);
      start = range.start;
      end = range.end;
    } else {
      // Use today's date in IST
      dateStr = toISTDateString(new Date());
      const range = getTodayRangeForDateColumn();
      start = range.start;
      end = range.end;
    }
    // 1. Ensure rows exist (mostly for new subscriptions or after midnight)
    await ensureTodayDeliveries(req.user.id, start, end);

    // 2. Optimized Single Query: Fetching everything in one go with DB-side filtering
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: { gte: start, lte: end },
        Customer: {
          status: 'ACTIVE',
          Pause: { none: { pauseDate: { gte: start, lte: end } } },
          Subscription: { isNot: null }
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            deliveryStartDate: true, // Include for filtering
            Wallet: { select: { balancePaise: true } },
            Subscription: true,
          },
        },
      },
      orderBy: { deliveryDate: 'asc' },
    });

    // 3. OPTIMIZED: Fetch ALL bottle ledgers in a SINGLE query (fixes N+1 problem)
    const customerIds = deliveries.map(d => d.customerId);
    const [modifications, bottleLedgers] = await Promise.all([
      prisma.deliveryModification.findMany({
        where: { date: { gte: start, lte: end } }
      }),
      // Get latest ledger for each customer in ONE query (safe parameterized query)
      customerIds.length > 0 ? prisma.$queryRaw<Array<{customerId: string, largeBottleBalanceAfter: number, smallBottleBalanceAfter: number}>>`
        SELECT DISTINCT ON ("customerId")
          "customerId",
          "largeBottleBalanceAfter",
          "smallBottleBalanceAfter"
        FROM "BottleLedger"
        WHERE "customerId" = ANY(${customerIds}::text[])
        ORDER BY "customerId", "createdAt" DESC
      ` : []
    ]);

    const modMap = new Map(modifications.map(m => [m.customerId, m]));
    const ledgerMap = new Map(bottleLedgers.map(l => [l.customerId, l]));

    // Map data without additional queries
    const deliveriesWithBalances = deliveries.map((d: any) => {
      // Apply modification override if exists
      const mod = modMap.get(d.customerId);
      if (mod && d.status === 'SCHEDULED') {
        d.quantityMl = mod.quantityMl;
        d.largeBottles = mod.largeBottles;
        d.smallBottles = mod.smallBottles;
        d.deliveryNotes = mod.notes;
      }

      // Get bottle balance from pre-fetched map
      const lastLedger = ledgerMap.get(d.customerId);

      return {
        ...d,
        bottleBalance: {
          large: lastLedger?.largeBottleBalanceAfter ?? 0,
          small: lastLedger?.smallBottleBalanceAfter ?? 0,
        }
      };
    });

    // 4. Final filter & sort (Wallet check, start date check, and status-based sorting)
    const filteredDeliveries = deliveriesWithBalances.filter((d: any) => {
      const c = d.Customer;
      if (!c || !c.Subscription) return false;

      // Customer deliveryStartDate check (admin-assigned start date)
      // If deliveryStartDate is set and is AFTER today, don't show this delivery
      if (c.deliveryStartDate) {
        const customerStartDate = new Date(c.deliveryStartDate);
        // Compare with the query date (start is already at UTC midnight for the target date)
        if (customerStartDate > start) return false;
      }

      // Start date check (in case subscription starts after today)
      if (c.Subscription.startDate) {
        const subStart = new Date(c.Subscription.startDate);
        subStart.setHours(0, 0, 0, 0);
        if (subStart > start) return false;
      }

      // If already processed (Delivered/Not Delivered), show it anyway
      if (d.status !== 'SCHEDULED') return true;

      // Wallet check ONLY for pending (SCHEDULED) deliveries
      const balance = c.Wallet?.balancePaise ?? 0;
      return balance >= 0; // Negative balance = don't show
    });

    // Sort: Pending (SCHEDULED) first, then processed ones at bottom
    const sortedDeliveries = filteredDeliveries.sort((a: any, b: any) => {
      if (a.status === 'SCHEDULED' && b.status !== 'SCHEDULED') return -1;
      if (a.status !== 'SCHEDULED' && b.status === 'SCHEDULED') return 1;
      return 0;
    });

    const completed = sortedDeliveries.filter((d: any) => d.status === 'DELIVERED').length;
    const totalLiters = sortedDeliveries.reduce((s: any, d: any) => s + d.quantityMl / 1000, 0);
    const total1LBottles = sortedDeliveries.reduce((s: any, d: any) => s + d.largeBottles, 0);
    const total500mlBottles = sortedDeliveries.reduce((s: any, d: any) => s + d.smallBottles, 0);

    // FIX: Transform Customer to customer for frontend compatibility
    const normalizedDeliveries = sortedDeliveries.map((d: any) => ({
      ...d,
      customer: d.Customer,
      Customer: undefined,
    }));

    res.json({
      date: dateStr,
      total: sortedDeliveries.length,
      completed,
      pending: sortedDeliveries.length - completed,
      totalLiters: Math.round(totalLiters * 10) / 10,
      total1LBottles,
      total500mlBottles,
      deliveries: normalizedDeliveries,
    });
  } catch (error) {
    console.error('Delivery today error:', error);
    res.status(500).json({ error: 'Failed to load deliveries' });
  }
});

// Delivery history for logged-in delivery person (date range)
router.get('/history', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    // Use UTC midnight dates for DATE column queries
    // Default: last 30 days to today (in IST timezone)
    const todayIST = toISTDateString(new Date());
    const thirtyDaysAgoIST = toISTDateString(addDaysIST(new Date(), -30));

    const fromRange = getDateRangeForDateColumn(from || thirtyDaysAgoIST);
    const toRange = getDateRangeForDateColumn(to || todayIST);

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: { gte: fromRange.start, lte: toRange.end },
        // Only show actual delivery attempts, not scheduled/paused records
        status: { in: ['DELIVERED', 'NOT_DELIVERED'] },
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
          },
        },
      },
      orderBy: { deliveryDate: 'desc' },
    });

    // FIX: Transform Customer to customer for frontend compatibility
    const normalizedDeliveries = deliveries.map((d: any) => ({
      ...d,
      customer: d.Customer,
      Customer: undefined,
    }));

    res.json({ deliveries: normalizedDeliveries });
  } catch (error) {
    console.error('Delivery history error:', error);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// Get single customer + delivery for a date (action page). ?date=YYYY-MM-DD defaults to today.
// Always returns 200 with customer info when assigned; delivery may be null if none for that date.
router.get('/customer/:customerId', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { customerId } = req.params;
    const dateParam = req.query.date as string | undefined;
    let targetDate: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      // Use UTC midnight for DATE column queries
      targetDate = getDateRangeForDateColumn(dateParam).start;
    } else {
      // Default to today's IST date at UTC midnight
      targetDate = getTodayRangeForDateColumn().start;
    }

    const [customer, delivery, lastLedger] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          id: customerId,
          deliveryPersonId: req.user.id,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          landmark: true,
          deliveryNotes: true,
          status: true,
          Subscription: { select: { dailyQuantityMl: true, status: true } },
        },
      }),
      prisma.delivery.findUnique({
        where: {
          customerId_deliveryDate: { customerId, deliveryDate: targetDate },
        },
      }),
      prisma.bottleLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { largeBottleBalanceAfter: true, smallBottleBalanceAfter: true },
      }),
    ]);

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // FIX: Use lowercase 'customer' for frontend compatibility
    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        landmark: customer.landmark,
        deliveryNotes: customer.deliveryNotes,
        status: customer.status,
        subscription: customer.Subscription
          ? {
            dailyQuantityMl: customer.Subscription.dailyQuantityMl,
            status: customer.Subscription.status,
          }
          : null,
      },
      delivery: delivery
        ? {
          id: delivery.id,
          deliveryDate: delivery.deliveryDate,
          quantityMl: delivery.quantityMl,
          largeBottles: delivery.largeBottles,
          smallBottles: delivery.smallBottles,
          status: delivery.status,
          deliveryNotes: delivery.deliveryNotes,
          largeBottlesCollected: delivery.largeBottlesCollected,
          smallBottlesCollected: delivery.smallBottlesCollected,
        }
        : null,
      bottleBalance: {
        large: lastLedger?.largeBottleBalanceAfter ?? 0,
        small: lastLedger?.smallBottleBalanceAfter ?? 0,
      },
      date: toISTDateString(targetDate),
    });
  } catch (error) {
    console.error('Delivery customer error:', error);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// Mark delivery status (and optional bottle collection)
router.patch('/:id/mark', deliveryActionLimiter, isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deliveryId = req.params.id;

    // Sanitize and validate input
    const body = sanitizeDeliveryData(req.body);

    const delivery = await prisma.delivery.findFirst({
      where: {
        id: deliveryId,
        deliveryPersonId: req.user.id,
        // Allow marking for today or past dates (in case they missed it)
        // deliveryDate: todayStart(), 
      },
      include: {
        Customer: {
          include: {
            Wallet: true,
          }
        }
      }
    });

    if (!delivery) return res.status(404).json(createErrorResponse(
      ErrorCode.DELIVERY_NOT_FOUND,
      getErrorMessage(ErrorCode.DELIVERY_NOT_FOUND)
    ));

    // 1. Prepare updates for the delivery record
    const updates: any = {};
    if (body.status) {
      updates.status = body.status;
      updates.deliveredAt = body.status === 'DELIVERED' ? new Date() : null;
    }
    if (typeof body.deliveryNotes === 'string') updates.deliveryNotes = body.deliveryNotes;
    if (typeof body.largeBottlesCollected === 'number') updates.largeBottlesCollected = body.largeBottlesCollected;
    if (typeof body.smallBottlesCollected === 'number') updates.smallBottlesCollected = body.smallBottlesCollected;

    // 2. Business Logic: Wallet and Bottles
    const customerId = delivery.customerId;
    // Charge wallet for both DELIVERED and NOT_DELIVERED (customer didn't pause)
    const shouldChargeWallet = (body.status === 'DELIVERED' || body.status === 'NOT_DELIVERED') && delivery.status === 'SCHEDULED';
    // Only issue bottles when actually delivered
    const shouldIssueBottles = body.status === 'DELIVERED' && delivery.status !== 'DELIVERED';

    // Fetch inventory BEFORE transaction
    const inventory = await prisma.inventory.findFirst();

    // Pre-check: Only block if current balance is ALREADY below grace limit
    // This handles stale deliveries for customers who shouldn't have them (e.g., deeply negative)
    // Customers within grace get charged normally — that IS the grace delivery
    if (shouldChargeWallet) {
      const charge = delivery.chargePaise || 0;
      const wallet = delivery.Customer.Wallet;
      if (wallet && charge > 0) {
        if (wallet.balancePaise < 0) {
          // Customer already negative — shouldn't have this delivery (stale row)
          // Mark NOT_DELIVERED without charging
          await prisma.delivery.update({
            where: { id: deliveryId },
            data: {
              status: 'NOT_DELIVERED',
              deliveryNotes: typeof body.deliveryNotes === 'string'
                ? body.deliveryNotes
                : 'Auto-skipped: insufficient wallet balance',
            },
          });
          // Update customer status (will set to INACTIVE)
          await updateCustomerStatus(customerId);
          // Invalidate assignees cache
          if (req.user) {
            assigneesCache.invalidate(`assignees_${req.user.id}`);
          }
          return res.json({
            success: true,
            warning: 'Customer set to inactive due to insufficient balance. Delivery marked as not delivered.',
          });
        }
      }
    }

    let warning: string | undefined;

    await prisma.$transaction(async (tx) => {
      // CRITICAL: Fetch bottle balance INSIDE transaction with SELECT FOR UPDATE lock
      // This prevents race conditions when multiple deliveries are marked concurrently
      const initialLedger = await tx.$queryRaw<Array<{largeBottleBalanceAfter: number, smallBottleBalanceAfter: number}>>`
        SELECT "largeBottleBalanceAfter", "smallBottleBalanceAfter"
        FROM "BottleLedger"
        WHERE "customerId" = ${customerId}
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `;

      // Track bottle balances through the transaction
      let currentLarge = initialLedger[0]?.largeBottleBalanceAfter ?? 0;
      let currentSmall = initialLedger[0]?.smallBottleBalanceAfter ?? 0;
      // A. Update delivery record
      await tx.delivery.update({
        where: { id: deliveryId },
        data: updates,
      });

      // A2. Increment delivery count and check for bottle deposit (every 90 deliveries)
      if (body.status === 'DELIVERED' && delivery.status !== 'DELIVERED') {
        // FIX: Use SELECT FOR UPDATE to prevent race condition on concurrent deliveries
        const subscription = await tx.$queryRaw<Array<{
          id: string;
          customerId: string;
          dailyQuantityMl: number;
          deliveryCount: number;
          lastDepositAtDelivery: number;
        }>>`
          SELECT id, "customerId", "dailyQuantityMl", "deliveryCount", "lastDepositAtDelivery"
          FROM "Subscription"
          WHERE "customerId" = ${customerId}
          FOR UPDATE
        `.then(rows => rows[0]);

        if (subscription) {
          const newDeliveryCount = subscription.deliveryCount + 1;

          // Check if deposit should be charged
          const { shouldChargeDeposit, calculateBottleDepositPaise } = await import('../config/pricing');
          if (shouldChargeDeposit(newDeliveryCount, subscription.lastDepositAtDelivery)) {
            const depositAmount = calculateBottleDepositPaise(subscription.dailyQuantityMl);

            // Deduct deposit from wallet
            const wallet = delivery.Customer.Wallet;
            if (wallet) {
              const newBalance = wallet.balancePaise - depositAmount;

              // Skip deposit if wallet would go negative (instead of throwing)
              if (newBalance < 0) {
                // Just increment delivery count; deposit will retry next qualifying delivery
                await tx.subscription.update({
                  where: { customerId },
                  data: { deliveryCount: newDeliveryCount }
                });
                warning = 'Bottle deposit skipped due to insufficient balance. It will be charged when balance is sufficient.';
              } else {
                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: { balancePaise: newBalance }
                });

                await tx.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: 'DEPOSIT_CHARGE',
                    amountPaise: -depositAmount,
                    balanceAfterPaise: newBalance,
                    description: `Bottle deposit charge (${newDeliveryCount} deliveries completed)`,
                    referenceType: 'deposit',
                    referenceId: delivery.id
                  }
                });

                // Update subscription deposit tracking
                await tx.subscription.update({
                  where: { customerId },
                  data: {
                    deliveryCount: newDeliveryCount,
                    lastDepositAtDelivery: newDeliveryCount,
                    lastDepositChargedAt: new Date()
                  }
                });
              }
            }
          } else {
            // Just increment delivery count
            await tx.subscription.update({
              where: { customerId },
              data: { deliveryCount: newDeliveryCount }
            });
          }
        }
      }

      // B. Deduct from wallet (for both DELIVERED and NOT_DELIVERED)
      if (shouldChargeWallet) {
        const charge = delivery.chargePaise || 0;
        if (charge > 0 && delivery.Customer.Wallet) {
          const newBalance = delivery.Customer.Wallet.balancePaise - charge;

          // Charge goes through — pre-check already blocked truly ineligible customers
          // Grace period allows this charge; updateCustomerStatus will handle INACTIVE transition after
          await tx.wallet.update({
            where: { id: delivery.Customer.Wallet.id },
            data: {
              balancePaise: newBalance,
              negativeBalanceSince: newBalance < 0 && delivery.Customer.Wallet.balancePaise >= 0
                ? new Date()
                : (newBalance >= 0 ? null : delivery.Customer.Wallet.negativeBalanceSince)
            }
          });
          await tx.walletTransaction.create({
            data: {
              walletId: delivery.Customer.Wallet.id,
              type: 'MILK_CHARGE',
              amountPaise: -charge,
              balanceAfterPaise: newBalance,
              description: `Milk delivery (${delivery.quantityMl}ml) on ${toISTDateString(delivery.deliveryDate)} - ${body.status}`,
              referenceType: 'delivery',
              referenceId: delivery.id
            }
          });
        }
      }

      // C. Issue bottles to customer ledger (only when actually delivered)
      if (shouldIssueBottles) {
        if (delivery.largeBottles > 0 || delivery.smallBottles > 0) {
          const issueDate = new Date(); // FIX: Set issue date for penalty tracking

          if (delivery.largeBottles > 0) {
            currentLarge += delivery.largeBottles;
            await tx.bottleLedger.create({
              data: {
                customerId,
                action: 'ISSUED',
                size: 'LARGE',
                quantity: delivery.largeBottles,
                largeBottleBalanceAfter: currentLarge,
                smallBottleBalanceAfter: currentSmall,
                deliveryId: delivery.id,
                issuedDate: issueDate, // FIX: Add issued date for penalty tracking
                description: `Delivered 1L bottles`
              }
            });
          }
          if (delivery.smallBottles > 0) {
            currentSmall += delivery.smallBottles;
            await tx.bottleLedger.create({
              data: {
                customerId,
                action: 'ISSUED',
                size: 'SMALL',
                quantity: delivery.smallBottles,
                largeBottleBalanceAfter: currentLarge,
                smallBottleBalanceAfter: currentSmall,
                deliveryId: delivery.id,
                issuedDate: issueDate, // FIX: Add issued date for penalty tracking
                description: `Delivered 500ml bottles`
              }
            });
          }

          // Update inventory: increment inCirculation for issued bottles
          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                largeBottlesInCirculation: {
                  increment: delivery.largeBottles,
                },
                smallBottlesInCirculation: {
                  increment: delivery.smallBottles,
                },
              },
            });
          }
        }
      }

      // D. Handle bottle collections (Independent of status upgrade, can happen any time)
      const newLargeCollected = (body.largeBottlesCollected ?? 0) - (delivery.largeBottlesCollected || 0);
      const newSmallCollected = (body.smallBottlesCollected ?? 0) - (delivery.smallBottlesCollected || 0);

      // Validation: Cannot collect more bottles than customer has
      if (newLargeCollected > currentLarge) {
        const error = createErrorResponse(
          ErrorCode.BOTTLE_COLLECTION_EXCEEDS_BALANCE,
          `Cannot collect ${newLargeCollected} large bottles. Customer only has ${currentLarge} bottles.`,
          { requested: newLargeCollected, available: currentLarge, type: 'large' }
        );
        throw new Error(JSON.stringify(error));
      }
      if (newSmallCollected > currentSmall) {
        const error = createErrorResponse(
          ErrorCode.BOTTLE_COLLECTION_EXCEEDS_BALANCE,
          `Cannot collect ${newSmallCollected} small bottles. Customer only has ${currentSmall} bottles.`,
          { requested: newSmallCollected, available: currentSmall, type: 'small' }
        );
        throw new Error(JSON.stringify(error));
      }

      if (newLargeCollected !== 0 || newSmallCollected !== 0) {
        if (newLargeCollected !== 0) {
          currentLarge -= newLargeCollected;
          await tx.bottleLedger.create({
            data: {
              customerId,
              action: 'RETURNED',
              size: 'LARGE',
              quantity: Math.abs(newLargeCollected),
              largeBottleBalanceAfter: currentLarge,
              smallBottleBalanceAfter: currentSmall,
              deliveryId: delivery.id,
              description: newLargeCollected > 0 ? `Collected 1L bottles` : `Correction: Reduced collected 1L bottles`
            }
          });
        }
        if (newSmallCollected !== 0) {
          currentSmall -= newSmallCollected;
          await tx.bottleLedger.create({
            data: {
              customerId,
              action: 'RETURNED',
              size: 'SMALL',
              quantity: Math.abs(newSmallCollected),
              largeBottleBalanceAfter: currentLarge,
              smallBottleBalanceAfter: currentSmall,
              deliveryId: delivery.id,
              description: newSmallCollected > 0 ? `Collected 500ml bottles` : `Correction: Reduced collected 500ml bottles`
            }
          });
        }

        // Update inventory: decrement inCirculation for collected bottles
        if ((newLargeCollected > 0 || newSmallCollected > 0) && inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              ...(newLargeCollected > 0 && {
                largeBottlesInCirculation: {
                  decrement: newLargeCollected,
                },
              }),
              ...(newSmallCollected > 0 && {
                smallBottlesInCirculation: {
                  decrement: newSmallCollected,
                },
              }),
            },
          });
        }
      }

      // Note: Bottle penalty checks moved to separate admin/cron job for performance
    }, {
      timeout: 10000, // 10 seconds - enough for bottle ledger operations
      isolationLevel: 'Serializable' // Highest isolation for financial operations
    });

    // Recalculate customer status after wallet changes (may transition to INACTIVE)
    try {
      await updateCustomerStatus(customerId);
    } catch (e) {
      console.error('Failed to update customer status after delivery:', e);
    }

    // Invalidate assignees cache for this delivery person
    if (req.user) {
      assigneesCache.invalidate(`assignees_${req.user.id}`);
    }

    res.json({ success: true, ...(warning && { warning }) });
  } catch (error) {
    console.error('Delivery mark error:', error);

    // Try to parse structured error (e.g., wallet balance, bottle collection errors)
    if (error instanceof Error && error.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(error.message);
        return res.status(parsed.statusCode || 400).json(parsed);
      } catch { /* not JSON, fall through */ }
    }

    res.status(500).json({ error: 'Failed to update delivery', details: error instanceof Error ? error.message : String(error) });
  }
});

// Bottle ledger summary: pending bottles per customer (for delivery person's customers)
router.get('/bottle-ledger', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const customers = await prisma.customer.findMany({
      where: { deliveryPersonId: req.user.id },
      select: { id: true, name: true, phone: true },
    });

    // Batch fetch bottle ledgers for ALL customers in single query (fixes N+1 problem)
    const customerIds = customers.map(c => c.id);
    const bottleLedgers = customerIds.length > 0
      ? await prisma.$queryRaw<Array<{customerId: string, largeBottleBalanceAfter: number, smallBottleBalanceAfter: number}>>`
          SELECT DISTINCT ON ("customerId")
            "customerId",
            "largeBottleBalanceAfter",
            "smallBottleBalanceAfter"
          FROM "BottleLedger"
          WHERE "customerId" = ANY(${customerIds}::text[])
          ORDER BY "customerId", "createdAt" DESC
        `
      : [];

    const ledgerMap = new Map(bottleLedgers.map(l => [l.customerId, l]));

    const summaries = customers.map(c => {
      const ledger = ledgerMap.get(c.id);
      return {
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        largePending: ledger?.largeBottleBalanceAfter ?? 0,
        smallPending: ledger?.smallBottleBalanceAfter ?? 0,
      };
    });

    res.json({ summaries });
  } catch (error) {
    console.error('Bottle ledger error:', error);
    res.status(500).json({ error: 'Failed to load bottle ledger' });
  }
});

export default router;

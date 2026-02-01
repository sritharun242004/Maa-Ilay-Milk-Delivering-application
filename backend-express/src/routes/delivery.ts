import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isAuthenticated, isDelivery } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function tomorrowStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Ensure Delivery rows exist for today for all customers who:
 * - Are assigned to this delivery person
 * - Have ACTIVE subscription
 * - Are NOT paused for today
 * - Have wallet balance >= 1 day's milk charge (paid)
 * Creates SCHEDULED Delivery rows if missing; does not overwrite existing rows.
 */
export async function ensureTodayDeliveries(deliveryPersonId: string, today: Date): Promise<void> {
  const [eligibleCustomers, existingDeliveries] = await Promise.all([
    prisma.customer.findMany({
      where: {
        deliveryPersonId,
        status: 'ACTIVE',
        subscription: { status: 'ACTIVE' },
        pauses: { none: { pauseDate: today } },
      },
      include: { subscription: true, wallet: true },
    }),
    prisma.delivery.findMany({
      where: { deliveryPersonId, deliveryDate: today },
      select: { customerId: true },
    }),
  ]);

  const existingSet = new Set(existingDeliveries.map((d) => d.customerId));
  const newDeliveries = eligibleCustomers
    .filter((c) => {
      if (existingSet.has(c.id)) return false;
      const sub = c.subscription;
      if (!sub) return false;

      // Start date check
      if (sub.startDate) {
        const startOnly = new Date(sub.startDate);
        startOnly.setHours(0, 0, 0, 0);
        if (today < startOnly) return false;
      }

      // Wallet balance check
      const balance = c.wallet?.balancePaise ?? 0;
      if (balance < sub.dailyPricePaise) return false;

      return true;
    })
    .map((c) => {
      const sub = c.subscription!;
      const quantityMl = sub.dailyQuantityMl;
      return {
        customerId: c.id,
        deliveryPersonId,
        deliveryDate: today,
        quantityMl,
        largeBottles: sub.largeBotles ?? (quantityMl >= 1000 ? Math.floor(quantityMl / 1000) : 0),
        smallBottles: sub.smallBottles ?? (quantityMl % 1000 >= 500 ? 1 : 0),
        chargePaise: sub.dailyPricePaise,
        depositPaise: 0,
        status: 'SCHEDULED' as const,
      };
    });

  if (newDeliveries.length > 0) {
    await prisma.delivery.createMany({
      data: newDeliveries,
      skipDuplicates: true,
    });
  }
}

// Current delivery person profile
router.get('/me', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const delivery = await prisma.deliveryPerson.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, phone: true, zone: true },
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
    const customers = await prisma.customer.findMany({
      where: { deliveryPersonId: req.user.id },
      include: {
        subscription: { select: { dailyQuantityMl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const list = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: `${c.addressLine1}${c.addressLine2 ? ', ' + c.addressLine2 : ''}, ${c.pincode}`,
      plan: c.subscription
        ? c.subscription.dailyQuantityMl >= 1000
          ? `${c.subscription.dailyQuantityMl / 1000}L`
          : `${c.subscription.dailyQuantityMl}ml`
        : '—',
      status: c.status,
    }));
    res.json({ assignees: list });
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
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split('-').map(Number);
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
      end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    } else {
      start = todayStart();
      end = tomorrowStart();
    }
    // 1. Ensure rows exist (mostly for new subscriptions or after midnight)
    await ensureTodayDeliveries(req.user.id, start);

    // 2. Optimized Single Query: Fetching everything in one go with DB-side filtering
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: { gte: start, lt: end },
        customer: {
          status: 'ACTIVE',
          pauses: { none: { pauseDate: start } }, // DB-side filtering for pauses
          subscription: { isNot: null }
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            wallet: { select: { balancePaise: true } },
            subscription: true,
          },
        },
      },
      orderBy: { deliveryDate: 'asc' },
    });

    // 3. Detailed Data Fetching (Bottle Balances & Full Customer info)
    // We need the latest bottle balance for the action page to be "pre-loaded"
    const deliveriesWithBalances = await Promise.all(deliveries.map(async (d) => {
      // Find latest bottle ledger for this customer
      const lastLedger = await prisma.bottleLedger.findFirst({
        where: { customerId: d.customerId },
        orderBy: { createdAt: 'desc' },
        select: { largeBottleBalanceAfter: true, smallBottleBalanceAfter: true },
      });

      return {
        ...d,
        bottleBalance: {
          large: lastLedger?.largeBottleBalanceAfter ?? 0,
          small: lastLedger?.smallBottleBalanceAfter ?? 0,
        }
      };
    }));

    // 4. Final lightweight validation (Wallet check, and start date check)
    // We do this in JS only for wallet balance and edge cases of start dates
    const filteredDeliveries = deliveriesWithBalances.filter(d => {
      const c = d.customer;
      if (!c || !c.subscription) return false;

      // Start date check (in case subscription starts after today)
      if (c.subscription.startDate) {
        const subStart = new Date(c.subscription.startDate);
        subStart.setHours(0, 0, 0, 0);
        if (subStart > start) return false;
      }

      // Wallet check
      const balance = c.wallet?.balancePaise ?? 0;
      const oneDay = c.subscription.dailyPricePaise;
      return balance >= oneDay;
    });

    const completed = filteredDeliveries.filter((d) => d.status === 'DELIVERED').length;
    const totalLiters = filteredDeliveries.reduce((s, d) => s + d.quantityMl / 1000, 0);
    const total1LBottles = filteredDeliveries.reduce((s, d) => s + d.largeBottles, 0);
    const total500mlBottles = filteredDeliveries.reduce((s, d) => s + d.smallBottles, 0);
    const dateStr =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    res.json({
      date: dateStr,
      total: filteredDeliveries.length,
      completed,
      pending: filteredDeliveries.length - completed,
      totalLiters: Math.round(totalLiters * 10) / 10,
      total1LBottles,
      total500mlBottles,
      deliveries: filteredDeliveries,
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
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: { gte: fromDate, lte: toDate },
      },
      include: {
        customer: {
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
    res.json({ deliveries });
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
      const [y, m, d] = dateParam.split('-').map(Number);
      targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      targetDate = todayStart();
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
          subscription: { select: { dailyQuantityMl: true, status: true } },
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
        subscription: customer.subscription
          ? {
            dailyQuantityMl: customer.subscription.dailyQuantityMl,
            status: customer.subscription.status,
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
      date: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`,
    });
  } catch (error) {
    console.error('Delivery customer error:', error);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// Mark delivery status (and optional bottle collection)
router.patch('/:id/mark', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deliveryId = req.params.id;
    const body = req.body as {
      status?: 'DELIVERED' | 'NOT_DELIVERED';
      deliveryNotes?: string;
      largeBottlesCollected?: number;
      smallBottlesCollected?: number;
    };

    const delivery = await prisma.delivery.findFirst({
      where: {
        id: deliveryId,
        deliveryPersonId: req.user.id,
        // Allow marking for today or past dates (in case they missed it)
        // deliveryDate: todayStart(), 
      },
      include: {
        customer: {
          include: {
            wallet: true,
          }
        }
      }
    });

    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

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
    const isNewDelivery = body.status === 'DELIVERED' && delivery.status !== 'DELIVERED';

    await prisma.$transaction(async (tx) => {
      // A. Update delivery record
      await tx.delivery.update({
        where: { id: deliveryId },
        data: updates,
      });

      // B. If newly delivered, deduct from wallet and issue bottles
      if (isNewDelivery) {
        const charge = delivery.chargePaise || 0;
        if (charge > 0 && delivery.customer.wallet) {
          const newBalance = delivery.customer.wallet.balancePaise - charge;
          await tx.wallet.update({
            where: { id: delivery.customer.wallet.id },
            data: { balancePaise: newBalance }
          });
          await tx.walletTransaction.create({
            data: {
              walletId: delivery.customer.wallet.id,
              type: 'MILK_CHARGE',
              amountPaise: -charge,
              balanceAfterPaise: newBalance,
              description: `Milk delivery (${delivery.quantityMl}ml) on ${delivery.deliveryDate.toISOString().slice(0, 10)}`,
              referenceType: 'delivery',
              referenceId: delivery.id
            }
          });
        }

        // Issue bottles to customer ledger
        if (delivery.largeBottles > 0 || delivery.smallBottles > 0) {
          const lastLedger = await tx.bottleLedger.findFirst({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
          });

          let currentLarge = lastLedger?.largeBottleBalanceAfter ?? 0;
          let currentSmall = lastLedger?.smallBottleBalanceAfter ?? 0;

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
                description: `Delivered 500ml bottles`
              }
            });
          }
        }
      }

      // C. Handle bottle collections (Independent of status upgrade, can happen any time)
      const newLargeCollected = (body.largeBottlesCollected ?? 0) - (delivery.largeBottlesCollected || 0);
      const newSmallCollected = (body.smallBottlesCollected ?? 0) - (delivery.smallBottlesCollected || 0);

      if (newLargeCollected !== 0 || newSmallCollected !== 0) {
        const lastLedger = await tx.bottleLedger.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        });

        let currentLarge = lastLedger?.largeBottleBalanceAfter ?? 0;
        let currentSmall = lastLedger?.smallBottleBalanceAfter ?? 0;

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
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delivery mark error:', error);
    res.status(500).json({ error: 'Failed to update delivery' });
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
    const summaries: { customerId: string; name: string; phone: string; largePending: number; smallPending: number }[] = [];
    for (const c of customers) {
      const ledgers = await prisma.bottleLedger.findMany({
        where: { customerId: c.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      const last = ledgers[0];
      summaries.push({
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        largePending: last?.largeBottleBalanceAfter ?? 0,
        smallPending: last?.smallBottleBalanceAfter ?? 0,
      });
    }
    res.json({ summaries });
  } catch (error) {
    console.error('Bottle ledger error:', error);
    res.status(500).json({ error: 'Failed to load bottle ledger' });
  }
});

export default router;

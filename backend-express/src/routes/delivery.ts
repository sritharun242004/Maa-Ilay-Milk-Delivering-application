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

// Today's deliveries for the logged-in delivery person
router.get('/today', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const start = todayStart();
    const end = tomorrowStart();
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: { gte: start, lt: end },
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
      orderBy: { deliveryDate: 'asc' },
    });
    const completed = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const totalLiters = deliveries.reduce((s, d) => s + d.quantityMl / 1000, 0);
    const total1LBottles = deliveries.reduce((s, d) => s + d.largeBottles, 0);
    const total500mlBottles = deliveries.reduce((s, d) => s + d.smallBottles, 0);
    res.json({
      date: start.toISOString().slice(0, 10),
      total: deliveries.length,
      completed,
      pending: deliveries.length - completed,
      totalLiters: Math.round(totalLiters * 10) / 10,
      total1LBottles,
      total500mlBottles,
      deliveries,
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

// Get single customer + today's delivery for action page
router.get('/customer/:customerId', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { customerId } = req.params;
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        deliveryPersonId: req.user.id,
      },
      include: {
        subscription: true,
        wallet: true,
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const today = todayStart();
    const delivery = await prisma.delivery.findUnique({
      where: {
        customerId_deliveryDate: { customerId, deliveryDate: today },
      },
    });
    if (!delivery) return res.status(404).json({ error: 'No delivery for today' });

    // Bottle balance from latest ledger
    const lastLedger = await prisma.bottleLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

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
      delivery: {
        id: delivery.id,
        deliveryDate: delivery.deliveryDate,
        quantityMl: delivery.quantityMl,
        largeBottles: delivery.largeBottles,
        smallBottles: delivery.smallBottles,
        status: delivery.status,
        deliveryNotes: delivery.deliveryNotes,
        largeBottlesCollected: delivery.largeBottlesCollected,
        smallBottlesCollected: delivery.smallBottlesCollected,
      },
      bottleBalance: {
        large: lastLedger?.largeBottleBalanceAfter ?? 0,
        small: lastLedger?.smallBottleBalanceAfter ?? 0,
      },
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
        deliveryDate: todayStart(),
      },
    });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const updates: {
      status?: 'DELIVERED' | 'NOT_DELIVERED';
      deliveredAt?: Date | null;
      deliveryNotes?: string;
      largeBottlesCollected?: number;
      smallBottlesCollected?: number;
    } = {};
    if (body.status === 'DELIVERED' || body.status === 'NOT_DELIVERED') {
      updates.status = body.status;
      updates.deliveredAt = body.status === 'DELIVERED' ? new Date() : null;
      if (body.status === 'NOT_DELIVERED') {
        updates.largeBottlesCollected = 0;
        updates.smallBottlesCollected = 0;
      } else if (typeof body.largeBottlesCollected === 'number' || typeof body.smallBottlesCollected === 'number') {
        updates.largeBottlesCollected = typeof body.largeBottlesCollected === 'number' ? body.largeBottlesCollected : 0;
        updates.smallBottlesCollected = typeof body.smallBottlesCollected === 'number' ? body.smallBottlesCollected : 0;
      }
    }
    if (typeof body.deliveryNotes === 'string') updates.deliveryNotes = body.deliveryNotes;

    await prisma.delivery.update({
      where: { id: deliveryId },
      data: updates,
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

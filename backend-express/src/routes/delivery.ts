import { Router } from 'express';
import { isAuthenticated, isDelivery } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));

// Today's deliveries for the logged-in delivery person
router.get('/today', isAuthenticated, isDelivery, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryPersonId: req.user.id,
        deliveryDate: todayStart(),
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
    res.json({
      date: todayStart().toISOString().slice(0, 10),
      total: deliveries.length,
      completed,
      pending: deliveries.length - completed,
      deliveries,
    });
  } catch (error) {
    console.error('Delivery today error:', error);
    res.status(500).json({ error: 'Failed to load deliveries' });
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

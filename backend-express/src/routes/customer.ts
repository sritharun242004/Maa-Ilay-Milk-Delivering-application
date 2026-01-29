import { Router } from 'express';
import { isAuthenticated, isCustomer } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

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
        deliveries: {
          where: { deliveryDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
          orderBy: { deliveryDate: 'asc' },
          take: 1,
          include: { deliveryPerson: true },
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
    const sub = customer.subscription;
    const nextDelivery = customer.deliveries[0] ?? null;
    const pauseDaysUsed = sub?.pauseDaysUsedThisMonth ?? customer.pauses?.length ?? 0;

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
        walletBalancePaise,
        walletBalanceRs: (walletBalancePaise / 100).toFixed(2),
      },
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            dailyQuantityMl: sub.dailyQuantityMl,
            dailyPricePaise: sub.dailyPricePaise,
            largeBotles: sub.largeBotles,
            smallBottles: sub.smallBottles,
            currentCycleStart: sub.currentCycleStart,
            paymentCycleCount: sub.paymentCycleCount,
            pauseDaysUsedThisMonth: sub.pauseDaysUsedThisMonth,
            pauseMonthYear: sub.pauseMonthYear,
          }
        : null,
      nextDelivery: nextDelivery
        ? {
            id: nextDelivery.id,
            deliveryDate: nextDelivery.deliveryDate,
            status: nextDelivery.status,
            quantityMl: nextDelivery.quantityMl,
            deliveryPerson: nextDelivery.deliveryPerson
              ? { id: nextDelivery.deliveryPerson.id, name: nextDelivery.deliveryPerson.name }
              : null,
          }
        : null,
      pauseDaysUsed,
      recentTransactions: customer.wallet?.transactions ?? [],
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;

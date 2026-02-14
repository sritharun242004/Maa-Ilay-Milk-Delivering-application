import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import prisma from '../config/prisma';
import { passwordResetLimiter } from '../middleware/rateLimiter';
import { calculateDailyPricePaise, calculateBottleDepositPaise } from '../config/pricing';
import { loadPricing } from '../config/pricingLoader';
import { ensureTodayDeliveries } from './delivery';
import { sanitizeName, sanitizePhone } from '../utils/sanitize';
import { PAGINATION, VALIDATION } from '../config/constants';
import { toISTDateString, getDateRangeForDateColumn, addDaysIST } from '../utils/dateUtils';
import { ErrorCode, createErrorResponse, getErrorMessage } from '../utils/errorCodes';
import {
  logCustomerAssignment,
  logDeliveryPersonCreated,
  logDeliveryPersonUpdated,
  logPasswordReset,
  logPenaltyImposed,
} from '../utils/auditLog';
import { MemoryCache } from '../lib/cache';

const dashboardCache = new MemoryCache();

const router = Router();

function syntheticDashboard() {
  return {
    todayLiters: 245,
    todayLitersChange: 12,
    bottlesOut: 312,
    bottlesCollected: 192,
    todayRevenueRs: '26950',
    todayRevenueChange: 8,
    pendingApprovals: 8,
    revenueTrend: [22000, 23500, 24100, 25200, 24800, 26100, 26950],
    recentActivities: [
      { text: 'New customer registration: Priya Sharma', time: '10 mins ago', type: 'registration' },
      { text: 'Subscription approved: Amit Kumar', time: '25 mins ago', type: 'approval' },
      { text: 'Payment received: ₹1,000 from Lakshmi Devi', time: '1 hour ago', type: 'payment' },
      { text: 'Bottle collected: 2x1L from Ravi Chandran', time: '2 hours ago', type: 'bottle' },
      { text: 'Delivery completed: Zone 1 - 18 customers', time: '3 hours ago', type: 'delivery' },
    ],
  };
}

router.get('/dashboard', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Check cache first (60s TTL)
    const cacheKey = 'admin_dashboard';
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'private, max-age=60');
      return res.json(cached);
    }

    // Use IST-aware date ranges for DATE column queries
    const todayIST = toISTDateString(new Date());
    const yesterdayIST = toISTDateString(addDaysIST(new Date(), -1));
    const sevenDaysAgoIST = toISTDateString(addDaysIST(new Date(), -6));

    const todayRange = getDateRangeForDateColumn(todayIST);
    const todayStart = todayRange.start;
    const todayEnd = todayRange.end;

    const sevenDaysAgoRange = getDateRangeForDateColumn(sevenDaysAgoIST);
    const sevenDaysAgo = sevenDaysAgoRange.start;

    // Ensure today's Delivery rows exist for all delivery persons (non-blocking)
    const allDeliveryPersons = await prisma.deliveryPerson.findMany({ select: { id: true } });
    // Fire in background — don't block dashboard response for row creation
    Promise.all(allDeliveryPersons.map((dp) => ensureTodayDeliveries(dp.id, todayStart, todayEnd))).catch(() => {});

    // Boundaries for Yesterday
    const yesterdayRange = getDateRangeForDateColumn(yesterdayIST);
    const yesterdayStart = yesterdayRange.start;
    const yesterdayEnd = yesterdayRange.end;

    const [
      todayDlRaw,
      yesterdayDl,
      pendingApprovalCount,
      recentCustomers,
      walletTransactions,
      activeCustomersWithBottles,
    ] = await Promise.all([
      prisma.delivery.findMany({
        where: { deliveryDate: { gte: todayStart, lte: todayEnd } },
        select: { id: true, quantityMl: true, status: true, chargePaise: true, largeBottlesCollected: true, smallBottlesCollected: true },
      }),
      prisma.delivery.findMany({
        where: { deliveryDate: { gte: yesterdayStart, lte: yesterdayEnd } },
        select: { quantityMl: true, status: true, chargePaise: true },
      }),
      prisma.customer.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.customer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { name: true, createdAt: true },
      }),
      prisma.walletTransaction.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'asc' },
        select: { type: true, amountPaise: true, createdAt: true },
      }),
      // Get total bottles in circulation from latest BottleLedger per active customer
      prisma.customer.findMany({
        where: { status: 'ACTIVE' },
        select: {
          BottleLedger: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { largeBottleBalanceAfter: true, smallBottleBalanceAfter: true },
          },
        },
      }),
    ]);

    // --- REPAIR & SYNC ---
    // Pre-load pricing map for price verification
    const pricingTiers = await loadPricing();
    const priceLookup = new Map(pricingTiers.map(t => [t.quantityMl, t.dailyPricePaise]));
    const getPrice = (qtyMl: number) => priceLookup.get(qtyMl) ?? 0;

    const incorrectPrices = todayDlRaw.filter(d => {
      const correct = getPrice(d.quantityMl);
      return correct > 0 && d.chargePaise !== correct;
    });
    if (incorrectPrices.length > 0) {
      prisma.$transaction(
        incorrectPrices.map(d =>
          prisma.delivery.update({ where: { id: d.id }, data: { chargePaise: getPrice(d.quantityMl) } })
        )
      ).catch(() => {});
    }
    const todayDl = todayDlRaw.map(d => {
      const correctPrice = getPrice(d.quantityMl);
      return correctPrice > 0 && d.chargePaise !== correctPrice ? { ...d, chargePaise: correctPrice } : d;
    });

    // KPI Calc: Today
    const deliveredToday = todayDl.filter(d => d.status === 'DELIVERED');
    const todayLiters = deliveredToday.reduce((s, d) => s + d.quantityMl / 1000, 0);
    const todayRev = deliveredToday.reduce((s, d) => s + d.chargePaise, 0);

    // Bottles in circulation: sum of latest ledger balances for all active customers
    const bottlesOut = activeCustomersWithBottles.reduce((s, c) => {
      const ledger = c.BottleLedger[0];
      if (!ledger) return s;
      return s + (ledger.largeBottleBalanceAfter || 0) + (ledger.smallBottleBalanceAfter || 0);
    }, 0);
    const bottlesCollected = todayDl.reduce((s, d) => s + (d.largeBottlesCollected || 0) + (d.smallBottlesCollected || 0), 0);

    // KPI Calc: Yesterday
    const deliveredYesterday = yesterdayDl.filter(d => d.status === 'DELIVERED');
    const yestLiters = deliveredYesterday.reduce((s, d) => s + d.quantityMl / 1000, 0);
    const yestRev = deliveredYesterday.reduce((s, d) => s + d.chargePaise, 0);

    // Trends
    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    const litersChange = calcChange(todayLiters, yestLiters);
    const revChange = calcChange(todayRev, yestRev);

    // Revenue Trend Line (last 7 days in IST)
    const revenueTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayIST = toISTDateString(addDaysIST(new Date(), -i));
      const dayRange = getDateRangeForDateColumn(dayIST);

      const dayTxns = walletTransactions.filter(
        (t) => new Date(t.createdAt) >= dayRange.start && new Date(t.createdAt) <= dayRange.end && t.amountPaise > 0
      );
      revenueTrend.push(Math.round(dayTxns.reduce((s, t) => s + t.amountPaise, 0) / 100));
    }

    const activities: { text: string; time: string; type: string }[] = recentCustomers.map((c) => {
      const mins = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60000);
      const timeStr =
        mins < 60 ? `${mins} mins ago` : mins < 1440 ? `${Math.floor(mins / 60)} hours ago` : `${Math.floor(mins / 1440)} days ago`;
      return { text: `New customer registration: ${c.name}`, time: timeStr, type: 'registration' };
    });

    const dashboardData = {
      todayLiters: Math.round(todayLiters * 10) / 10,
      todayLitersChange: litersChange,
      bottlesOut,
      bottlesCollected,
      todayRevenueRs: String(Math.round(todayRev / 100)),
      todayRevenueChange: revChange,
      pendingApprovals: pendingApprovalCount,
      revenueTrend,
      recentActivities: activities.length > 0 ? activities : syntheticDashboard().recentActivities,
    };

    // Cache for 60 seconds
    dashboardCache.set(cacheKey, dashboardData, 60_000);
    res.set('Cache-Control', 'private, max-age=60');
    res.json(dashboardData);
  } catch (e) {
    console.error('Admin dashboard error:', e);
    res.json(syntheticDashboard());
  }
});

// Get today's deliveries with customer names and delivery persons
router.get('/today-deliveries', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Use IST date for DATE column query
    const todayIST = toISTDateString(new Date());
    const todayRange = getDateRangeForDateColumn(todayIST);

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryDate: { gte: todayRange.start, lte: todayRange.end },
        status: 'DELIVERED'
      },
      include: {
        Customer: {
          select: { name: true }
        },
        DeliveryPerson: {
          select: { name: true }
        }
      },
      orderBy: { deliveredAt: 'desc' }
    });

    const formattedDeliveries = deliveries.map(d => ({
      customerName: d.Customer.name,
      liters: d.quantityMl / 1000,
      deliveryPersonName: d.DeliveryPerson?.name || 'Unassigned',
      status: d.status
    }));

    res.json({ deliveries: formattedDeliveries });
  } catch (e) {
    console.error('Today deliveries error:', e);
    res.status(500).json({ error: 'Failed to fetch deliveries', deliveries: [] });
  }
});

// Admin Deliveries — master data with filters and pagination
router.get('/deliveries-history', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    // Filters
    const dateStr = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const deliveryPersonId = req.query.deliveryPersonId as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};

    // Date filter — single date or range
    if (dateStr) {
      const range = getDateRangeForDateColumn(dateStr);
      where.deliveryDate = { gte: range.start, lte: range.end };
    } else if (dateFrom || dateTo) {
      where.deliveryDate = {};
      if (dateFrom) {
        const fromRange = getDateRangeForDateColumn(dateFrom);
        where.deliveryDate.gte = fromRange.start;
      }
      if (dateTo) {
        const toRange = getDateRangeForDateColumn(dateTo);
        where.deliveryDate.lte = toRange.end;
      }
    } else {
      // Default: today
      const todayIST = toISTDateString(new Date());
      const range = getDateRangeForDateColumn(todayIST);
      where.deliveryDate = { gte: range.start, lte: range.end };
    }

    if (deliveryPersonId) {
      where.deliveryPersonId = deliveryPersonId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.Customer = {
        name: { contains: search, mode: 'insensitive' },
      };
    }

    const [deliveries, total, aggregates, deliveryPersons] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          Customer: { select: { name: true, phone: true } },
          DeliveryPerson: { select: { name: true } },
        },
        orderBy: [{ deliveryDate: 'desc' }, { deliveredAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.delivery.count({ where }),
      // Aggregate stats for the full filtered dataset
      prisma.delivery.aggregate({
        where,
        _sum: { quantityMl: true, largeBottles: true, smallBottles: true },
      }),
      // Delivery persons list for filter dropdown
      prisma.deliveryPerson.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const formatted = deliveries.map(d => ({
      id: d.id,
      date: d.deliveryDate,
      customerName: d.Customer.name,
      customerPhone: d.Customer.phone,
      quantityMl: d.quantityMl,
      liters: d.quantityMl / 1000,
      largeBottles: d.largeBottles,
      smallBottles: d.smallBottles,
      deliveryPersonName: d.DeliveryPerson?.name || 'Unassigned',
      status: d.status,
      largeBottlesCollected: d.largeBottlesCollected,
      smallBottlesCollected: d.smallBottlesCollected,
      deliveredAt: d.deliveredAt,
    }));

    res.json({
      deliveries: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalLiters: Math.round((aggregates._sum.quantityMl || 0) / 100) / 10,
      total1LBottles: aggregates._sum.largeBottles || 0,
      total500mlBottles: aggregates._sum.smallBottles || 0,
      deliveryPersons,
    });
  } catch (e) {
    console.error('Admin deliveries history error:', e);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

// Export deliveries as CSV
router.get('/deliveries-export', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const deliveryPersonId = req.query.deliveryPersonId as string;
    const status = req.query.status as string;

    const where: any = {};

    if (dateStr) {
      const range = getDateRangeForDateColumn(dateStr);
      where.deliveryDate = { gte: range.start, lte: range.end };
    } else if (dateFrom || dateTo) {
      where.deliveryDate = {};
      if (dateFrom) {
        const fromRange = getDateRangeForDateColumn(dateFrom);
        where.deliveryDate.gte = fromRange.start;
      }
      if (dateTo) {
        const toRange = getDateRangeForDateColumn(dateTo);
        where.deliveryDate.lte = toRange.end;
      }
    } else {
      const todayIST = toISTDateString(new Date());
      const range = getDateRangeForDateColumn(todayIST);
      where.deliveryDate = { gte: range.start, lte: range.end };
    }

    if (deliveryPersonId) where.deliveryPersonId = deliveryPersonId;
    if (status && status !== 'ALL') where.status = status;

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        Customer: { select: { name: true, phone: true } },
        DeliveryPerson: { select: { name: true } },
      },
      orderBy: [{ deliveryDate: 'desc' }, { deliveredAt: 'desc' }],
    });

    const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const title = `"Maa Ilay Deliveries - ${todayStr}"`;
    const header = 'S.No,Date,Customer,Phone,Quantity,Bottles,Delivered By,Status,Time';
    const csvRows = deliveries.map((d, i) => {
      const dateVal = new Date(d.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const qty = d.quantityMl >= 1000 ? `${d.quantityMl / 1000}L` : `${d.quantityMl}ml`;
      const bottles = [
        d.largeBottles > 0 ? `${d.largeBottles}x1L` : '',
        d.smallBottles > 0 ? `${d.smallBottles}x500ml` : '',
      ].filter(Boolean).join(' + ');
      const time = d.deliveredAt
        ? new Date(d.deliveredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';
      return [
        i + 1,
        dateVal,
        `"${d.Customer.name.replace(/"/g, '""')}"`,
        d.Customer.phone,
        qty,
        bottles,
        d.DeliveryPerson?.name || 'Unassigned',
        d.status,
        time,
      ].join(',');
    });

    const csv = [title, header, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=deliveries.csv');
    res.send(csv);
  } catch (e) {
    console.error('Admin deliveries export error:', e);
    res.status(500).json({ error: 'Failed to export deliveries' });
  }
});

// Get deliveries by date (for date navigation in Today's Deliveries page)
router.get('/deliveries-by-date', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'Date parameter is required', deliveries: [] });
    }

    // Parse date string (format: YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD', deliveries: [] });
    }

    // Create UTC date boundaries for the specified date
    const dateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryDate: { gte: dateStart, lte: dateEnd },
        status: 'DELIVERED'
      },
      include: {
        Customer: {
          select: { name: true }
        },
        DeliveryPerson: {
          select: { name: true }
        }
      },
      orderBy: { deliveredAt: 'desc' }
    });

    const formattedDeliveries = deliveries.map(d => ({
      customerName: d.Customer.name,
      liters: d.quantityMl / 1000,
      deliveryPersonName: d.DeliveryPerson?.name || 'Unassigned',
      status: d.status,
      deliveryDate: dateStr
    }));

    res.json({ deliveries: formattedDeliveries });
  } catch (e) {
    console.error('Deliveries by date error:', e);
    res.status(500).json({ error: 'Failed to fetch deliveries', deliveries: [] });
  }
});

// Get customers with bottles out (bottle balance)
router.get('/bottles-out', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Get latest bottle balance for each customer
    const customers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        BottleLedger: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            largeBottleBalanceAfter: true,
            smallBottleBalanceAfter: true
          }
        }
      }
    });

    const bottlesData = customers
      .map(c => {
        const latestBalance = c.BottleLedger[0];
        if (!latestBalance) return null;

        const largeBottles = latestBalance.largeBottleBalanceAfter;
        const smallBottles = latestBalance.smallBottleBalanceAfter;
        const totalBottles = largeBottles + smallBottles;

        // Only include customers with bottles out
        if (totalBottles === 0) return null;

        return {
          customerName: c.name,
          largeBottles,
          smallBottles,
          totalBottles
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.totalBottles || 0) - (a?.totalBottles || 0));

    res.json({ bottles: bottlesData });
  } catch (e) {
    console.error('Bottles out error:', e);
    res.status(500).json({ error: 'Failed to fetch bottles data', bottles: [] });
  }
});

router.get('/customers', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const statusFilter = req.query.status as string | undefined;

    // Pagination parameters
    const page = Math.max(PAGINATION.DEFAULT_PAGE, parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(PAGINATION.MAX_LIMIT, Math.max(PAGINATION.MIN_LIMIT, parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const where = {
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
        : {}),
      ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter as any } : {}),
    };

    // Get total count for pagination
    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          Subscription: { select: { dailyQuantityMl: true } },
          DeliveryPerson: { select: { id: true, name: true } },
          Wallet: { select: { balancePaise: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where })
    ]);

    const list = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      walletBalanceRs: c.Wallet ? (c.Wallet.balancePaise / 100).toFixed(2) : '0.00',
      plan: c.Subscription
        ? c.Subscription.dailyQuantityMl >= 1000
          ? `${c.Subscription.dailyQuantityMl / 1000}L`
          : `${c.Subscription.dailyQuantityMl}ml`
        : '—',
      status: c.status,
      deliveryPersonId: c.deliveryPersonId ?? null,
      deliveryPersonName: c.DeliveryPerson?.name ?? '—',
    }));

    const totalPages = Math.ceil(totalCount / limit);

    // Add pagination headers (REST best practice)
    res.set('X-Total-Count', totalCount.toString());
    res.set('X-Page', page.toString());
    res.set('X-Per-Page', limit.toString());
    res.set('X-Total-Pages', totalPages.toString());
    res.set('X-Has-More', (page < totalPages).toString());

    res.json({
      customers: list,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      }
    });
  } catch (e) {
    console.error('Admin customers error:', e);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

// Export customers as CSV (respects filters)
router.get('/customers-export', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const statusFilter = req.query.status as string | undefined;

    const where = {
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
        : {}),
      ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter as any } : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      include: {
        Subscription: { select: { dailyQuantityMl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = customers.map((c, i) => ({
      sno: i + 1,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: `${c.addressLine1}${c.addressLine2 ? ', ' + c.addressLine2 : ''}, ${c.city} ${c.pincode}`,
      onboardedDate: c.approvedAt
        ? new Date(c.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
      plan: c.Subscription
        ? c.Subscription.dailyQuantityMl >= 1000
          ? `${c.Subscription.dailyQuantityMl / 1000}L`
          : `${c.Subscription.dailyQuantityMl}ml`
        : '',
    }));

    // Build CSV
    const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const title = `"Maa Ilay Customer's - ${todayStr}"`;
    const header = 'S.No,Name,Phone,Email,Address,Onboarded Date,Plan';
    const csvRows = rows.map((r) =>
      [
        r.sno,
        `"${r.name.replace(/"/g, '""')}"`,
        r.phone,
        r.email,
        `"${r.address.replace(/"/g, '""')}"`,
        r.onboardedDate,
        r.plan,
      ].join(',')
    );
    const csv = [title, header, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send(csv);
  } catch (e) {
    console.error('Admin customers export error:', e);
    res.status(500).json({ error: 'Failed to export customers' });
  }
});

// Get single customer full detail (admin): personal info, wallet, last transaction, subscription, bottle balance, calendar
router.get('/customers/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const now = new Date();
    // Accept optional year/month query parameters for calendar navigation
    const year = req.query.year ? parseInt(req.query.year as string) : now.getUTCFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getUTCMonth();

    // UTC month boundaries
    const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        DeliveryPerson: true,
        Subscription: true,
        Wallet: {
          include: {
            WalletTransaction: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        BottleLedger: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        Pause: {
          where: { pauseDate: { gte: firstDay, lte: lastDay } },
        },
        DeliveryModification: {
          where: { date: { gte: firstDay, lte: lastDay } },
        },
      },
    });
    if (!customer) return res.status(404).json(createErrorResponse(
      ErrorCode.CUSTOMER_NOT_FOUND,
      getErrorMessage(ErrorCode.CUSTOMER_NOT_FOUND)
    ));

    const deliveries = await prisma.delivery.findMany({
      where: {
        customerId: id,
        deliveryDate: { gte: firstDay, lte: lastDay },
      },
      select: { deliveryDate: true, status: true },
    });

    const formatDate = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

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

    const modificationsByDate: Record<string, any> = {};
    for (const m of customer.DeliveryModification) {
      const dateStr = formatDate(m.date);
      modificationsByDate[dateStr] = {
        quantityMl: m.quantityMl,
        largeBottles: m.largeBottles,
        smallBottles: m.smallBottles,
        notes: m.notes
      };
    }

    const lastLedger = customer.BottleLedger[0];
    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        landmark: customer.landmark,
        city: customer.city,
        pincode: customer.pincode,
        status: customer.status,
        deliveryNotes: customer.deliveryNotes,
        approvedAt: customer.approvedAt,
        deliveryPerson: customer.DeliveryPerson
          ? { id: customer.DeliveryPerson.id, name: customer.DeliveryPerson.name }
          : null,
      },
      wallet: customer.Wallet
        ? {
          balancePaise: customer.Wallet.balancePaise,
          balanceRs: (customer.Wallet.balancePaise / 100).toFixed(2),
        }
        : null,
      lastTransaction: customer.Wallet?.WalletTransaction?.[0]
        ? {
          id: customer.Wallet.WalletTransaction[0].id,
          type: customer.Wallet.WalletTransaction[0].type,
          amountPaise: customer.Wallet.WalletTransaction[0].amountPaise,
          amountRs: (customer.Wallet.WalletTransaction[0].amountPaise / 100).toFixed(2),
          description: customer.Wallet.WalletTransaction[0].description,
          createdAt: customer.Wallet.WalletTransaction[0].createdAt,
        }
        : null,
      subscription: customer.Subscription
        ? {
          dailyQuantityMl: customer.Subscription.dailyQuantityMl,
          dailyPricePaise: customer.Subscription.dailyPricePaise,
          status: customer.Subscription.status,
          largeBottles: customer.Subscription.largeBotles,
          smallBottles: customer.Subscription.smallBottles,
        }
        : null,
      bottleBalance: lastLedger
        ? { large: lastLedger.largeBottleBalanceAfter, small: lastLedger.smallBottleBalanceAfter }
        : { large: 0, small: 0 },
      calendar: {
        year,
        month,
        pausedDates: customer.Pause.map((p) => formatDate(p.pauseDate)),
        modificationsByDate,
        deliveryStatusByDate,
      },
    });
  } catch (e) {
    console.error('Admin customer detail error:', e);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// Update customer (admin): e.g. reassign delivery person
router.patch('/customers/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const deliveryPersonId = req.body?.deliveryPersonId as string | null | undefined;
    const deliveryStartDate = req.body?.deliveryStartDate as string | undefined;

    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { Subscription: true, Wallet: true }
    });
    if (!existing) return res.status(404).json(createErrorResponse(
      ErrorCode.CUSTOMER_NOT_FOUND,
      getErrorMessage(ErrorCode.CUSTOMER_NOT_FOUND)
    ));

    const data: any = {};
    let depositCharged = false;
    let depositAmountPaise = 0;

    if (deliveryPersonId !== undefined) {
      if (deliveryPersonId === null || deliveryPersonId === '') {
        // Unassigning delivery person - move back to PENDING_APPROVAL
        data.deliveryPersonId = null;
        data.deliveryStartDate = null; // Clear start date when unassigning
        data.status = 'PENDING_APPROVAL';
      } else {
        const dp = await prisma.deliveryPerson.findUnique({ where: { id: deliveryPersonId } });
        if (!dp) return res.status(400).json({ error: 'Delivery person not found' });
        data.deliveryPersonId = deliveryPersonId;

        // When assigning a delivery person, activate the customer if they're pending
        if (existing.status === 'PENDING_APPROVAL') {
          data.approvedAt = new Date();
          data.approvedBy = req.user?.id ?? null;

          // Charge first bottle deposit
          if (existing.Subscription && existing.Wallet) {
            depositAmountPaise = await calculateBottleDepositPaise(existing.Subscription.dailyQuantityMl);

            const currentBalance = existing.Wallet.balancePaise;
            if (currentBalance < depositAmountPaise) {
              return res.status(400).json(createErrorResponse(
                ErrorCode.INSUFFICIENT_BALANCE,
                `Insufficient wallet balance for bottle deposit. Required: ₹${depositAmountPaise / 100}, Available: ₹${currentBalance / 100}`,
                {
                  required: depositAmountPaise / 100,
                  available: currentBalance / 100,
                  shortfall: (depositAmountPaise - currentBalance) / 100
                }
              ));
            }

            // Deduct deposit from wallet in a transaction
            await prisma.$transaction(async (tx) => {
              const newBalance = currentBalance - depositAmountPaise;

              // Update wallet balance
              await tx.wallet.update({
                where: { customerId: id },
                data: { balancePaise: newBalance }
              });

              // Create transaction record
              await tx.walletTransaction.create({
                data: {
                  walletId: existing.Wallet!.id,
                  type: 'DEPOSIT_CHARGE',
                  amountPaise: -depositAmountPaise,
                  balanceAfterPaise: newBalance,
                  description: `Bottle deposit charge for ${existing.Subscription!.dailyQuantityMl}ml subscription`,
                  referenceType: 'deposit',
                  performedByAdminId: req.user?.id
                }
              });

              // Update subscription deposit tracking
              await tx.subscription.update({
                where: { customerId: id },
                data: {
                  lastDepositAtDelivery: 0,
                  lastDepositChargedAt: new Date()
                }
              });
            });

            depositCharged = true;

            // Check balance after deposit to set correct status (ACTIVE or INACTIVE)
            const balanceAfterDeposit = currentBalance - depositAmountPaise;

            if (balanceAfterDeposit >= 0) {
              data.status = 'ACTIVE';
            } else {
              data.status = 'INACTIVE';
            }
          } else {
            // No wallet or subscription, just set to ACTIVE (edge case)
            data.status = 'ACTIVE';
          }
        }

        // Set delivery start date if provided
        if (deliveryStartDate) {
          const parsedDate = new Date(deliveryStartDate);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'Invalid delivery start date' });
          }
          data.deliveryStartDate = parsedDate;
        }
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No updates provided' });

    // Log the assignment/unassignment action
    if (deliveryPersonId !== undefined && req.user) {
      await logCustomerAssignment(
        req.user.id,
        id,
        existing.deliveryPersonId,
        data.deliveryPersonId || null,
        req
      );
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
      include: { DeliveryPerson: true, Subscription: true, Wallet: true },
    });

    // Create delivery records for the assigned customer starting from deliveryStartDate
    if (data.deliveryPersonId && customer.Subscription && customer.status === 'ACTIVE') {
      const startDate = customer.deliveryStartDate ? new Date(customer.deliveryStartDate) : new Date();
      const deliveryDate = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        0, 0, 0, 0
      ));
      const deliveryDateEnd = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        23, 59, 59, 999
      ));

      // Check if delivery record already exists for this date or if customer is paused
      const [existingDelivery, isPaused] = await Promise.all([
        prisma.delivery.findFirst({
          where: {
            customerId: id,
            deliveryDate: { gte: deliveryDate, lte: deliveryDateEnd }
          }
        }),
        prisma.pause.findFirst({
          where: {
            customerId: id,
            pauseDate: { gte: deliveryDate, lte: deliveryDateEnd }
          }
        })
      ]);

      // Create delivery record if it doesn't exist, not paused, and wallet has sufficient balance
      if (!existingDelivery && !isPaused) {
        const sub = customer.Subscription;
        const balance = customer.Wallet?.balancePaise ?? 0;

        // Only create if customer has non-negative balance
        if (balance >= 0) {
          const quantityMl = sub.dailyQuantityMl;
          const chargePaise = await calculateDailyPricePaise(quantityMl);

          await prisma.delivery.create({
            data: {
              customerId: id,
              deliveryPersonId: data.deliveryPersonId,
              deliveryDate: deliveryDate,
              quantityMl,
              largeBottles: sub.largeBotles ?? Math.floor(quantityMl / 1000),
              smallBottles: sub.smallBottles ?? ((quantityMl % 1000) >= 500 ? 1 : 0),
              chargePaise,
              depositPaise: 0,
              status: 'SCHEDULED'
            }
          });
        }
      }
    }

    res.json({
      success: true,
      customer: {
        id: customer.id,
        deliveryPersonId: customer.deliveryPersonId,
        deliveryPersonName: customer.DeliveryPerson?.name ?? '—',
        deliveryStartDate: customer.deliveryStartDate,
      },
      depositCharged,
      depositAmount: depositCharged ? depositAmountPaise / 100 : 0
    });
  } catch (e) {
    console.error('Admin update customer error:', e);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.get('/delivery-team', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Use IST date for DATE column query
    const todayIST = toISTDateString(new Date());
    const todayRange = getDateRangeForDateColumn(todayIST);

    const staff = await prisma.deliveryPerson.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { Customer: true } },
        // FIX: Only count DELIVERED deliveries for todayDeliveries
        Delivery: {
          where: {
            deliveryDate: { gte: todayRange.start, lte: todayRange.end },
            status: 'DELIVERED'
          },
          select: { id: true },
        },
      },
    });

    // FIX: Get VISIBLE deliveries (same filters as delivery person portal)
    const todayLoads = await Promise.all(
      staff.map(async (s) => {
        // Get deliveries with same filters as delivery person view
        const deliveries = await prisma.delivery.findMany({
          where: {
            deliveryPersonId: s.id,
            deliveryDate: { gte: todayRange.start, lte: todayRange.end },
            Customer: {
              status: 'ACTIVE',
              Pause: { none: { pauseDate: { gte: todayRange.start, lte: todayRange.end } } },
              Subscription: { isNot: null }
            }
          },
          include: {
            Customer: {
              select: {
                deliveryStartDate: true,
                Wallet: { select: { balancePaise: true } },
                Subscription: { select: { dailyPricePaise: true, startDate: true } }
              }
            }
          }
        });

        // Apply same business logic filters as delivery person portal
        const visibleDeliveries = deliveries.filter((d) => {
          const c = d.Customer;
          if (!c || !c.Subscription) return false;

          // Delivery start date check (admin-assigned)
          if (c.deliveryStartDate) {
            const customerStartDate = new Date(c.deliveryStartDate);
            if (customerStartDate > todayRange.start) return false;
          }

          // Subscription start date check
          if (c.Subscription.startDate) {
            const subStart = new Date(c.Subscription.startDate);
            if (subStart > todayRange.start) return false;
          }

          // If already completed/not delivered, always count it
          if (d.status !== 'SCHEDULED') return true;

          // Wallet check for SCHEDULED deliveries — negative = skip
          const balance = c.Wallet?.balancePaise ?? 0;
          return balance >= 0;
        });

        return { id: s.id, load: visibleDeliveries.length };
      })
    );

    const loadMap = new Map(todayLoads.map(l => [l.id, l.load]));

    const list = staff.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      status: s.isActive ? 'active' : 'inactive',
      mustChangePassword: false,
      customerCount: s._count.Customer,
      todayDeliveries: s.Delivery.length, // Now only counts DELIVERED
      todayLoad: loadMap.get(s.id) || 0, // Total assigned for today (all statuses)
      maxLoad: 25,
    }));

    const totalStaff = list.length;
    const activeCount = list.filter((s) => s.status === 'active').length;
    const onRouteToday = list.filter((s) => s.status === 'active' && s.todayDeliveries > 0).length;

    // FIX: Reduce cache for real-time accuracy
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes cache (was 1 hour)
    res.json({
      totalStaff,
      activeToday: activeCount, // Change to reflect active account status as per user request
      onRouteToday,
      staff: list,
    });
  } catch (e) {
    console.error('Admin delivery-team error:', e);
    res.status(500).json({ error: 'Failed to load delivery team' });
  }
});

// Create new delivery person (admin sets initial one-time password)
router.post('/delivery-team', isAuthenticated, isAdmin, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const adminId = req.user.id;

    // Sanitize and validate inputs
    const name = sanitizeName(req.body.name);
    const phone = sanitizePhone(req.body.phone);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!password || password.length < VALIDATION.PASSWORD.MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters` });
    }

    const existing = await prisma.deliveryPerson.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ error: 'Phone number already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const person = await prisma.deliveryPerson.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        isActive: true,
        createdByAdminId: adminId,
      },
      select: { id: true, name: true, phone: true, isActive: true },
    });

    // Audit log
    await logDeliveryPersonCreated(adminId, person.id, { name, phone, isActive: true }, req);

    res.status(201).json({ success: true, DeliveryPerson: person });
  } catch (e) {
    console.error('Admin create delivery person error:', e);
    res.status(500).json({ error: 'Failed to create delivery person' });
  }
});

// Update delivery person (name, phone, isActive)
router.patch('/delivery-team/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    // Sanitize and validate inputs (only if provided)
    const name = req.body.name !== undefined ? sanitizeName(req.body.name) : undefined;
    const phone = req.body.phone !== undefined ? sanitizePhone(req.body.phone) : undefined;
    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;

    const existing = await prisma.deliveryPerson.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Delivery person not found' });

    if (phone !== undefined && phone !== existing.phone) {
      const duplicate = await prisma.deliveryPerson.findUnique({ where: { phone } });
      if (duplicate) return res.status(400).json({ error: 'Phone number already in use' });
    }

    const data: { name?: string; phone?: string; isActive?: boolean } = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;

    const person = await prisma.deliveryPerson.update({
      where: { id },
      data,
      select: { id: true, name: true, phone: true, isActive: true },
    });

    // Audit log
    if (req.user) {
      await logDeliveryPersonUpdated(
        req.user.id,
        id,
        { name: existing.name, phone: existing.phone, isActive: existing.isActive },
        data,
        req
      );
    }

    res.json({ success: true, DeliveryPerson: person });
  } catch (e) {
    console.error('Admin update delivery person error:', e);
    res.status(500).json({ error: 'Failed to update delivery person' });
  }
});

// Reset password (admin sets one-time password; delivery person must change on next login)
router.post('/delivery-team/:id/reset-password', passwordResetLimiter, isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!newPassword || newPassword.length < VALIDATION.PASSWORD.MIN_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters` });
    }

    const existing = await prisma.deliveryPerson.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Delivery person not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.deliveryPerson.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Audit log
    if (req.user) {
      await logPasswordReset(req.user.id, id, req);
    }

    // SECURITY: Never return plain-text password in API response
    // Admin should communicate password via secure channel (SMS/email)
    res.json({
      success: true,
      message: 'Password has been reset successfully. Please communicate the new password to the delivery person via secure channel.',
    });
  } catch (e) {
    console.error('Admin reset delivery password error:', e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});


// Get delivery details for a specific customer and date
router.get('/customers/:id/delivery/:date', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const customerId = req.params.id;
    const dateStr = req.params.date;

    // Parse date string (format: YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Create UTC date boundaries for the specified date
    const dateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const delivery = await prisma.delivery.findFirst({
      where: {
        customerId,
        deliveryDate: { gte: dateStart, lte: dateEnd }
      },
      include: {
        DeliveryPerson: {
          select: { name: true }
        },
        Customer: {
          select: { name: true }
        }
      }
    });

    if (!delivery) {
      return res.status(404).json({ error: 'No delivery found for this date' });
    }

    res.json({
      delivery: {
        date: dateStr,
        customerName: delivery.Customer.name,
        deliveryPersonName: delivery.DeliveryPerson?.name || 'Unassigned',
        quantityMl: delivery.quantityMl,
        liters: delivery.quantityMl / 1000,
        largeBottles: Math.floor(delivery.quantityMl / 1000),
        smallBottles: (delivery.quantityMl % 1000) >= 500 ? 1 : 0,
        status: delivery.status,
        chargePaise: delivery.chargePaise,
        chargeRs: (delivery.chargePaise / 100).toFixed(2),
        deliveredAt: delivery.deliveredAt,
        largeBottlesCollected: delivery.largeBottlesCollected,
        smallBottlesCollected: delivery.smallBottlesCollected
      }
    });
  } catch (e) {
    console.error('Admin delivery detail error:', e);
    res.status(500).json({ error: 'Failed to fetch delivery details' });
  }
});

router.get('/inventory', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // FIX: Calculate actual bottles in circulation from BottleLedger (source of truth)
    const customers = await prisma.customer.findMany({
      where: { status: { in: ['ACTIVE', 'INACTIVE', 'PAUSED'] } }, // All customers who might have bottles
      include: {
        BottleLedger: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            largeBottleBalanceAfter: true,
            smallBottleBalanceAfter: true
          }
        }
      }
    });

    let largeCirc = 0;
    let smallCirc = 0;

    for (const customer of customers) {
      const latestBalance = customer.BottleLedger[0];
      if (latestBalance) {
        largeCirc += latestBalance.largeBottleBalanceAfter;
        smallCirc += latestBalance.smallBottleBalanceAfter;
      }
    }

    // Get inventory totals from Inventory table
    const inv = await prisma.inventory.findFirst();
    const largeTotal = inv?.largeBottlesTotal ?? 300;
    const smallTotal = inv?.smallBottlesTotal ?? 200;

    // Add cache headers - inventory changes less frequently
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes cache
    res.json({
      totalBottles: largeTotal + smallTotal,
      largeTotal,
      smallTotal,
      withCustomers: largeCirc + smallCirc,
      largeInCirculation: largeCirc,
      smallInCirculation: smallCirc,
      inWarehouse: largeTotal + smallTotal - largeCirc - smallCirc,
      largeInWarehouse: largeTotal - largeCirc,
      smallInWarehouse: smallTotal - smallCirc,
    });
  } catch (e) {
    console.error('Admin inventory error:', e);
    res.status(500).json(createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to load inventory',
      { originalError: e instanceof Error ? e.message : String(e) }
    ));
  }
});

router.get('/penalties', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { getPenaltyStatistics, getFlaggedCustomersDetailed } = await import('../services/penaltyService');
    const [stats, flaggedCustomers] = await Promise.all([
      getPenaltyStatistics(),
      getFlaggedCustomersDetailed(),
    ]);

    // Add cache headers - penalties change less frequently
    res.set('Cache-Control', 'private, max-age=60'); // 1 minute cache
    res.json({
      totalPendingBottles: stats.totalPendingBottles,
      flaggedCustomersCount: stats.flaggedCustomersCount,
      flaggedCustomers: flaggedCustomers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        deliveryPersonName: c.deliveryPersonName,
        largeBottles: c.largeBottles,
        smallBottles: c.smallBottles,
        totalBottles: c.largeBottles + c.smallBottles,
        oldestBottleDate: c.oldestBottleDate,
        daysOverdue: c.daysOverdue,
      })),
      rules: stats.rules,
    });
  } catch (e) {
    console.error('Admin penalties error:', e);
    res.status(500).json({ error: 'Failed to load penalty statistics' });
  }
});

// Get payment records (wallet top-ups) with customer info
router.get('/payments', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    // Build where clause
    const where: any = {
      type: 'WALLET_TOPUP',
    };

    // Date filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const fromRange = getDateRangeForDateColumn(dateFrom);
        where.createdAt.gte = fromRange.start;
      }
      if (dateTo) {
        const toRange = getDateRangeForDateColumn(dateTo);
        where.createdAt.lte = toRange.end;
      }
    }

    // Search by customer name
    if (search) {
      where.Wallet = {
        Customer: {
          name: { contains: search, mode: 'insensitive' },
        },
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        include: {
          Wallet: {
            include: {
              Customer: {
                select: { name: true, phone: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    // Calculate total amount for the filtered set
    const totalAmountResult = await prisma.walletTransaction.aggregate({
      where,
      _sum: { amountPaise: true },
    });

    const payments = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      customerName: t.Wallet.Customer.name,
      customerPhone: t.Wallet.Customer.phone,
      amountPaise: t.amountPaise,
      amountRs: (t.amountPaise / 100).toFixed(2),
      description: t.description,
      referenceId: t.referenceId,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      payments,
      total,
      page,
      limit,
      totalPages,
      totalAmountRs: ((totalAmountResult._sum.amountPaise || 0) / 100).toFixed(2),
    });
  } catch (e) {
    console.error('Admin payments error:', e);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Export payments as CSV
router.get('/payments-export', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const where: any = { type: 'WALLET_TOPUP' };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const fromRange = getDateRangeForDateColumn(dateFrom);
        where.createdAt.gte = fromRange.start;
      }
      if (dateTo) {
        const toRange = getDateRangeForDateColumn(dateTo);
        where.createdAt.lte = toRange.end;
      }
    }

    if (search) {
      where.Wallet = {
        Customer: { name: { contains: search, mode: 'insensitive' } },
      };
    }

    const transactions = await prisma.walletTransaction.findMany({
      where,
      include: {
        Wallet: {
          include: {
            Customer: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const title = `"Maa Ilay Payments - ${todayStr}"`;
    const header = 'S.No,Date,Customer,Phone,Amount';
    const csvRows = transactions.map((t, i) => {
      const dateVal = new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const amountRs = (t.amountPaise / 100).toFixed(2);
      return [
        i + 1,
        dateVal,
        `"${t.Wallet.Customer.name.replace(/"/g, '""')}"`,
        t.Wallet.Customer.phone,
        amountRs,
      ].join(',');
    });

    const csv = [title, header, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.send(csv);
  } catch (e) {
    console.error('Admin payments export error:', e);
    res.status(500).json({ error: 'Failed to export payments' });
  }
});

// Manually impose fine on a customer for unreturned bottles
router.post('/penalties/impose', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { customerId, fineAmountRs, largeBottlesToFine, smallBottlesToFine } = req.body;

    if (!customerId || !fineAmountRs || fineAmountRs <= 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const fineAmountPaise = Math.round(fineAmountRs * 100);

    const { imposePenaltyOnCustomer } = await import('../services/penaltyService');
    const result = await imposePenaltyOnCustomer(
      customerId,
      fineAmountPaise,
      largeBottlesToFine ?? 0,
      smallBottlesToFine ?? 0
    );

    if (result.success && req.user) {
      // Audit log
      await logPenaltyImposed(
        req.user.id,
        customerId,
        {
          fineAmountRs,
          largeBottlesFined: largeBottlesToFine ?? 0,
          smallBottlesFined: smallBottlesToFine ?? 0,
          totalChargedRs: result.totalCharged,
        },
        req
      );

      res.json({
        success: true,
        message: result.message,
        totalChargedRs: result.totalCharged,
      });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (e) {
    console.error('Admin impose penalty error:', e);
    res.status(500).json({ error: 'Failed to impose fine' });
  }
});

// ============================================================================
// PRODUCTS & PRICING
// ============================================================================

// Get all product pricing tiers (admin view)
router.get('/products', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const tiers = await prisma.productPricing.findMany({
      orderBy: { quantityMl: 'asc' },
    });
    res.json({ tiers });
  } catch (e) {
    console.error('Admin products error:', e);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Update a product pricing tier
router.patch('/products/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyPricePaise, largeBottleDepositPaise, smallBottleDepositPaise } = req.body;

    const existing = await prisma.productPricing.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Product tier not found' });

    // Validate inputs — reject clearly invalid values instead of silently skipping
    if (dailyPricePaise !== undefined) {
      if (typeof dailyPricePaise !== 'number' || dailyPricePaise <= 0) {
        return res.status(400).json({ error: 'Daily price must be a positive number' });
      }
    }
    if (largeBottleDepositPaise !== undefined) {
      if (typeof largeBottleDepositPaise !== 'number' || largeBottleDepositPaise < 0) {
        return res.status(400).json({ error: 'Large bottle deposit must be >= 0' });
      }
    }
    if (smallBottleDepositPaise !== undefined) {
      if (typeof smallBottleDepositPaise !== 'number' || smallBottleDepositPaise < 0) {
        return res.status(400).json({ error: 'Small bottle deposit must be >= 0' });
      }
    }

    const data: any = {};
    if (dailyPricePaise !== undefined) data.dailyPricePaise = Math.round(dailyPricePaise);
    if (largeBottleDepositPaise !== undefined) data.largeBottleDepositPaise = Math.round(largeBottleDepositPaise);
    if (smallBottleDepositPaise !== undefined) data.smallBottleDepositPaise = Math.round(smallBottleDepositPaise);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    data.updatedByAdminId = req.user?.id ?? null;

    const updated = await prisma.productPricing.update({
      where: { id },
      data,
    });

    // Invalidate pricing cache so new prices take effect immediately
    const { invalidatePricingCache } = await import('../config/pricingLoader');
    invalidatePricingCache();

    // Audit log
    if (req.user) {
      await prisma.adminAuditLog.create({
        data: {
          adminId: req.user.id,
          action: 'UPDATE_PRICING',
          entityType: 'ProductPricing',
          entityId: id,
          oldValue: {
            dailyPricePaise: existing.dailyPricePaise,
            largeBottleDepositPaise: existing.largeBottleDepositPaise,
            smallBottleDepositPaise: existing.smallBottleDepositPaise,
          },
          newValue: data,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });
    }

    res.json({ success: true, tier: updated });
  } catch (e) {
    console.error('Admin update product error:', e);
    res.status(500).json({ error: 'Failed to update product pricing' });
  }
});

export default router;

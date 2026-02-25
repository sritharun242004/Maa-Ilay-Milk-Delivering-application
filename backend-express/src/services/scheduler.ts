import cron from 'node-cron';
import { checkAndChargePenalties } from './penaltyService';
import prisma from '../config/prisma';
import { calculateDailyPricePaise } from '../config/pricing';
import { GRACE_PERIOD_END_DAY } from '../config/constants';

/**
 * Daily penalty check scheduler
 * Runs every day at 1:00 AM IST to check and charge penalties for overdue bottles
 */
export function startPenaltyScheduler() {
  const job = cron.schedule('0 1 * * *', async () => {
    const now = new Date();
    console.log('[Scheduler] Running daily penalty check at', now.toISOString());

    try {
      const results = await checkAndChargePenalties();
      const successCount = results.filter(r => r.success).length;
      const totalCharged = results.reduce((sum, r) => sum + (r.success ? r.totalPenaltyPaise : 0), 0);

      console.log(`[Scheduler] Penalty check completed. Charged ${successCount} customers. Total: Rs${totalCharged / 100}`);
    } catch (error) {
      console.error('[Scheduler] Error running penalty check:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  job.start();
  console.log('[Scheduler] Penalty scheduler started. Will run daily at 1:00 AM IST');
  return job;
}

/**
 * Monthly payment scheduler
 * Runs daily at 12:05 AM IST
 * - On 1st of month: creates MonthlyPayment records for all active customers
 * - On 8th+ of month: marks PENDING payments as OVERDUE, sets customers to INACTIVE
 */
export function startMonthlyPaymentScheduler() {
  const job = cron.schedule('5 0 * * *', async () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDay = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    console.log(`[Scheduler] Monthly payment check: Day ${currentDay} of ${year}-${String(month).padStart(2, '0')}`);

    try {
      if (currentDay === 1) {
        await createMonthlyPaymentRecords(year, month);
      }

      if (currentDay > GRACE_PERIOD_END_DAY) {
        await enforceOverduePayments(year, month);
      }
    } catch (error) {
      console.error('[Scheduler] Error in monthly payment scheduler:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  job.start();
  console.log('[Scheduler] Monthly payment scheduler started. Will run daily at 12:05 AM IST');
  return job;
}

/**
 * Create MonthlyPayment records for all customers with active subscriptions
 * Runs on the 1st of each month
 */
async function createMonthlyPaymentRecords(year: number, month: number): Promise<void> {
  console.log(`[Scheduler] Creating monthly payment records for ${year}-${String(month).padStart(2, '0')}...`);

  // Find all customers with subscriptions and delivery persons
  const customers = await prisma.customer.findMany({
    where: {
      deliveryPersonId: { not: null },
      status: { in: ['ACTIVE', 'INACTIVE'] },
      Subscription: { status: { in: ['ACTIVE', 'PAUSED'] } },
    },
    include: { Subscription: true, Wallet: true },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const dueDate = new Date(year, month - 1, GRACE_PERIOD_END_DAY);

  let created = 0;
  let autoPaid = 0;

  for (const customer of customers) {
    if (!customer.Subscription) continue;

    // Check if record already exists
    const existing = await prisma.monthlyPayment.findUnique({
      where: { customerId_year_month: { customerId: customer.id, year, month } },
    });

    if (existing) continue;

    const dailyRatePaise = await calculateDailyPricePaise(customer.Subscription.dailyQuantityMl);
    const totalCostPaise = dailyRatePaise * daysInMonth;
    const walletBalance = customer.Wallet?.balancePaise ?? 0;
    const amountDuePaise = Math.max(0, totalCostPaise - walletBalance);

    // If wallet covers the full month, auto-mark as PAID
    const isPaid = walletBalance >= totalCostPaise;

    await prisma.monthlyPayment.create({
      data: {
        customerId: customer.id,
        year,
        month,
        totalCostPaise,
        amountDuePaise: isPaid ? 0 : amountDuePaise,
        amountPaidPaise: isPaid ? totalCostPaise : 0,
        status: isPaid ? 'PAID' : 'PENDING',
        dueDate,
        paidAt: isPaid ? new Date() : null,
      },
    });

    created++;
    if (isPaid) autoPaid++;
  }

  console.log(`[Scheduler] Created ${created} monthly payment records (${autoPaid} auto-paid by wallet balance)`);
}

/**
 * Enforce overdue payments after grace period
 * Runs daily after the 7th: marks PENDING → OVERDUE, sets customers to INACTIVE
 */
async function enforceOverduePayments(year: number, month: number): Promise<void> {
  console.log(`[Scheduler] Enforcing overdue payments for ${year}-${String(month).padStart(2, '0')}...`);

  // Find all PENDING payments for this month
  const pendingPayments = await prisma.monthlyPayment.findMany({
    where: { year, month, status: 'PENDING' },
    select: { id: true, customerId: true },
  });

  if (pendingPayments.length === 0) {
    console.log('[Scheduler] No overdue payments to enforce');
    return;
  }

  // Mark as OVERDUE
  await prisma.monthlyPayment.updateMany({
    where: { year, month, status: 'PENDING' },
    data: { status: 'OVERDUE' },
  });

  // Set those customers to INACTIVE
  const customerIds = pendingPayments.map(p => p.customerId);
  await prisma.customer.updateMany({
    where: {
      id: { in: customerIds },
      status: { not: 'PENDING_APPROVAL' }, // Don't change customers awaiting approval
    },
    data: { status: 'INACTIVE' },
  });

  console.log(`[Scheduler] Marked ${pendingPayments.length} payments as OVERDUE, ${customerIds.length} customers set to INACTIVE`);
}

/**
 * Start all scheduled jobs
 */
export function startAllSchedulers() {
  const penaltyJob = startPenaltyScheduler();
  const monthlyPaymentJob = startMonthlyPaymentScheduler();

  return {
    penaltyJob,
    monthlyPaymentJob,
  };
}

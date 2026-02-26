import prisma from '../config/prisma';
import { calculateDailyPricePaise, calculateBottleDepositPaise, shouldChargeDeposit, PRICING } from '../config/pricing';
import { GRACE_PERIOD_END_DAY, NEXT_MONTH_PREVIEW_DAYS } from '../config/constants';
import { getNowIST, getCurrentHourIST } from './dateUtils';
import { PAUSE_CUTOFF_HOUR } from '../config/constants';

/**
 * Get number of days in a given month (1-indexed month: 1=Jan, 12=Dec)
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Check if the current date is within the grace period (day 1-7)
 */
export function isInGracePeriod(date?: Date): boolean {
  const d = date ?? getNowIST();
  return d.getDate() <= GRACE_PERIOD_END_DAY;
}

/**
 * Calculate the monthly subscription cost for a customer
 */
export async function calculateMonthlyDue(
  customerId: string,
  year: number,
  month: number // 1-12
): Promise<{
  totalCostPaise: number;
  walletBalancePaise: number;
  amountDuePaise: number;
  daysInMonth: number;
  dailyRatePaise: number;
}> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { Subscription: true, Wallet: true },
  });

  if (!customer?.Subscription) {
    throw new Error('Customer has no subscription');
  }

  const dailyRatePaise = await calculateDailyPricePaise(customer.Subscription.dailyQuantityMl);
  const days = daysInMonth(year, month);
  const totalCostPaise = dailyRatePaise * days;
  const walletBalancePaise = customer.Wallet?.balancePaise ?? 0;
  const amountDuePaise = Math.max(0, totalCostPaise - walletBalancePaise);

  return {
    totalCostPaise,
    walletBalancePaise,
    amountDuePaise,
    daysInMonth: days,
    dailyRatePaise,
  };
}

/**
 * Calculate first-time subscription payment (partial month + deposit)
 * Respects 4 PM cutoff — if after 4 PM, delivery starts day after tomorrow
 */
export async function calculateFirstPayment(dailyQuantityMl: number): Promise<{
  remainingDays: number;
  milkCostPaise: number;
  depositPaise: number;
  totalPaise: number;
  startDate: Date;
  year: number;
  month: number; // 1-12
}> {
  const now = getNowIST();
  const currentHour = getCurrentHourIST();

  // Determine delivery start date
  let startDate: Date;
  if (currentHour >= PAUSE_CUTOFF_HOUR) {
    // After 4 PM: delivery starts day after tomorrow
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  } else {
    // Before 4 PM: delivery starts tomorrow
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  const startDay = startDate.getDate();
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1; // 1-indexed
  const totalDaysInMonth = daysInMonth(year, month);

  // Check if start date crosses into next month
  let remainingDays: number;
  let paymentYear: number;
  let paymentMonth: number;

  if (startDay > totalDaysInMonth) {
    // Crossed into next month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthDays = daysInMonth(nextYear, nextMonth);
    remainingDays = nextMonthDays - 1; // Start from 2nd of next month
    paymentYear = nextYear;
    paymentMonth = nextMonth;
  } else {
    remainingDays = totalDaysInMonth - startDay + 1; // inclusive of start day
    paymentYear = year;
    paymentMonth = month;
  }

  const dailyRatePaise = await calculateDailyPricePaise(dailyQuantityMl);
  const milkCostPaise = dailyRatePaise * remainingDays;
  const depositPaise = await calculateBottleDepositPaise(dailyQuantityMl);
  const totalPaise = milkCostPaise + depositPaise;

  return {
    remainingDays,
    milkCostPaise,
    depositPaise,
    totalPaise,
    startDate,
    year: paymentYear,
    month: paymentMonth,
  };
}

/**
 * Check if a customer has paid for a specific month
 */
export async function isMonthPaid(
  customerId: string,
  year: number,
  month: number // 1-12
): Promise<boolean> {
  const payment = await prisma.monthlyPayment.findUnique({
    where: { customerId_year_month: { customerId, year, month } },
  });
  return payment?.status === 'PAID';
}

/**
 * Get or create a MonthlyPayment record for a given customer/month
 */
export async function getOrCreateMonthlyPayment(
  customerId: string,
  year: number,
  month: number // 1-12
): Promise<{
  id: string;
  status: string;
  totalCostPaise: number;
  amountDuePaise: number;
  amountPaidPaise: number;
  dueDate: Date;
  paidAt: Date | null;
}> {
  const existing = await prisma.monthlyPayment.findUnique({
    where: { customerId_year_month: { customerId, year, month } },
  });

  if (existing) return existing;

  // Create new record
  const { totalCostPaise, walletBalancePaise, amountDuePaise } = await calculateMonthlyDue(
    customerId,
    year,
    month
  );

  const dueDate = new Date(year, month - 1, GRACE_PERIOD_END_DAY); // month is 0-indexed for Date constructor

  // If wallet covers full month, auto-mark as PAID
  const isPaid = walletBalancePaise >= totalCostPaise;

  const record = await prisma.monthlyPayment.create({
    data: {
      customerId,
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

  return record;
}

/**
 * Calculate how many bottle deposit charges will fire during a delivery window.
 * Returns { depositCount, sinceLastDepositAfter } so we can chain windows.
 *
 * @param deliveriesInWindow  Number of actual deliveries in the window
 * @param sinceLastDeposit    Deliveries since last deposit charge (0..119)
 */
function countDepositsInWindow(
  deliveriesInWindow: number,
  sinceLastDeposit: number
): { depositCount: number; sinceLastDepositAfter: number } {
  if (deliveriesInWindow <= 0) {
    return { depositCount: 0, sinceLastDepositAfter: sinceLastDeposit };
  }

  const deliveriesToNextDeposit = PRICING.DEPOSIT_INTERVAL_DELIVERIES - sinceLastDeposit;

  if (deliveriesInWindow < deliveriesToNextDeposit) {
    // No deposit fires in this window
    return { depositCount: 0, sinceLastDepositAfter: sinceLastDeposit + deliveriesInWindow };
  }

  // First deposit fires
  const remaining = deliveriesInWindow - deliveriesToNextDeposit;
  const additionalDeposits = Math.floor(remaining / PRICING.DEPOSIT_INTERVAL_DELIVERIES);
  const leftover = remaining % PRICING.DEPOSIT_INTERVAL_DELIVERIES;

  return {
    depositCount: 1 + additionalDeposits,
    sinceLastDepositAfter: leftover,
  };
}

/**
 * Calculate next month preview for advance payment
 * Available during the last NEXT_MONTH_PREVIEW_DAYS days of the current month.
 * Accounts for bottle deposit charges (every 120 deliveries) in both the
 * remaining current-month window and the next-month window.
 */
export async function calculateNextMonthPreview(customerId: string): Promise<{
  isPreviewAvailable: boolean;
  nextMonth?: number;
  nextYear?: number;
  nextMonthName?: string;
  dailyRatePaise?: number;
  daysInNextMonth?: number;
  nextMonthCostPaise?: number;
  currentBalancePaise?: number;
  remainingChargesPaise?: number;
  projectedBalancePaise?: number;
  shortfallPaise?: number;
  walletCoversNextMonth?: boolean;
  deliveryCount?: number;
  deliveriesUntilNextDeposit?: number;
  bottleDepositPaise?: number;
  depositsInNextMonth?: number;
  depositChargePaise?: number;
}> {
  const now = getNowIST();
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const totalDaysInCurrentMonth = daysInMonth(currentYear, currentMonth);

  // Only available during last N days of the month
  if (currentDay <= totalDaysInCurrentMonth - NEXT_MONTH_PREVIEW_DAYS) {
    return { isPreviewAvailable: false };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { Subscription: true, Wallet: true },
  });

  if (!customer?.Subscription) {
    return { isPreviewAvailable: false };
  }

  const sub = customer.Subscription;
  const dailyRatePaise = await calculateDailyPricePaise(sub.dailyQuantityMl);
  const currentBalancePaise = customer.Wallet?.balancePaise ?? 0;

  // Calculate remaining delivery days this month (days after today)
  const remainingDaysInMonth = totalDaysInCurrentMonth - currentDay;

  // Get paused dates for remaining days
  const remainingStart = new Date(currentYear, currentMonth - 1, currentDay + 1);
  const monthEnd = new Date(currentYear, currentMonth - 1, totalDaysInCurrentMonth);
  const pauses = await prisma.pause.findMany({
    where: {
      customerId,
      pauseDate: { gte: remainingStart, lte: monthEnd },
    },
  });
  const pausedDaysRemaining = pauses.length;
  const remainingDeliveryDays = Math.max(0, remainingDaysInMonth - pausedDaysRemaining);
  const remainingMilkChargesPaise = remainingDeliveryDays * dailyRatePaise;

  // --- Bottle deposit projection ---
  const deliveryCount = sub.deliveryCount;
  const lastDepositAtDelivery = sub.lastDepositAtDelivery;
  const sinceLastDeposit = deliveryCount - lastDepositAtDelivery; // 0..89
  const bottleDepositPaise = await calculateBottleDepositPaise(sub.dailyQuantityMl);

  // Deposits during remaining days of this month
  const thisMonthDeposits = countDepositsInWindow(remainingDeliveryDays, sinceLastDeposit);
  const depositsThisMonthRemaining = thisMonthDeposits.depositCount;
  const depositChargeThisMonthPaise = depositsThisMonthRemaining * bottleDepositPaise;

  // Total remaining charges this month (milk + deposits)
  const remainingChargesPaise = remainingMilkChargesPaise + depositChargeThisMonthPaise;

  // Project balance after this month's remaining charges
  const projectedBalancePaise = currentBalancePaise - remainingChargesPaise;

  // Next month calculation
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const nextMonthDays = daysInMonth(nextYear, nextMonth);
  const nextMonthMilkPaise = dailyRatePaise * nextMonthDays;

  // Deposits during next month (assumes all days are delivery days — conservative estimate)
  const nextMonthDeposits = countDepositsInWindow(nextMonthDays, thisMonthDeposits.sinceLastDepositAfter);
  const depositsInNextMonth = nextMonthDeposits.depositCount;
  const depositChargeNextMonthPaise = depositsInNextMonth * bottleDepositPaise;

  // Total next month cost (milk + deposits)
  const nextMonthCostPaise = nextMonthMilkPaise + depositChargeNextMonthPaise;

  // Shortfall = how much more the customer needs to cover next month
  const effectiveBalance = Math.max(0, projectedBalancePaise);
  const shortfallPaise = Math.max(0, nextMonthCostPaise - effectiveBalance);

  // Deliveries until next deposit (from current count)
  const deliveriesUntilNextDeposit = PRICING.DEPOSIT_INTERVAL_DELIVERIES - sinceLastDeposit;

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    isPreviewAvailable: true,
    nextMonth,
    nextYear,
    nextMonthName: monthNames[nextMonth],
    dailyRatePaise,
    daysInNextMonth: nextMonthDays,
    nextMonthCostPaise,
    currentBalancePaise,
    remainingChargesPaise,
    projectedBalancePaise,
    shortfallPaise,
    walletCoversNextMonth: shortfallPaise === 0,
    deliveryCount,
    deliveriesUntilNextDeposit,
    bottleDepositPaise,
    depositsInNextMonth,
    depositChargePaise: depositChargeNextMonthPaise,
  };
}

/**
 * Get monthly payment status for dashboard display
 */
export async function getMonthlyPaymentStatus(customerId: string): Promise<{
  status: string;
  totalCostPaise: number;
  amountDuePaise: number;
  amountPaidPaise: number;
  dueDate: string;
  paidAt: string | null;
  year: number;
  month: number;
  isGracePeriod: boolean;
  paymentRequired: boolean;
} | null> {
  const now = getNowIST();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  const payment = await prisma.monthlyPayment.findUnique({
    where: { customerId_year_month: { customerId, year, month } },
  });

  if (!payment) return null;

  const grace = isInGracePeriod(now);

  return {
    status: payment.status,
    totalCostPaise: payment.totalCostPaise,
    amountDuePaise: payment.amountDuePaise,
    amountPaidPaise: payment.amountPaidPaise,
    dueDate: payment.dueDate.toISOString().split('T')[0],
    paidAt: payment.paidAt?.toISOString() ?? null,
    year: payment.year,
    month: payment.month,
    isGracePeriod: grace,
    paymentRequired: payment.status !== 'PAID',
  };
}

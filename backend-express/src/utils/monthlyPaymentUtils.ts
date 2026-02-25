import prisma from '../config/prisma';
import { calculateDailyPricePaise, calculateBottleDepositPaise } from '../config/pricing';
import { GRACE_PERIOD_END_DAY } from '../config/constants';
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

// ==================== PRICING CONSTANTS ====================

// Milk pricing (in paise - 100 paise = 1 rupee)
export const MILK_PRICE_PER_LITER_PAISE = 11000 // ₹110 per liter
export const MILK_PRICE_PER_500ML_PAISE = 5500  // ₹55 per 500ml

// Bottle deposit pricing (in paise)
export const DEPOSIT_LARGE_BOTTLE_PAISE = 3500  // ₹35 for 1L bottle
export const DEPOSIT_SMALL_BOTTLE_PAISE = 2500  // ₹25 for 500ml bottle

// Penalty pricing (same as deposit)
export const PENALTY_LARGE_BOTTLE_PAISE = 3500  // ₹35 penalty
export const PENALTY_SMALL_BOTTLE_PAISE = 2500  // ₹25 penalty

// ==================== SUBSCRIPTION CONSTANTS ====================

// Quantity limits (in ml)
export const MIN_DAILY_QUANTITY_ML = 500
export const MAX_DAILY_QUANTITY_ML = 3000
export const QUANTITY_STEP_ML = 500

// Subscription cycles
export const DEPOSIT_CYCLE_MONTHS = 3 // Deposit every 3 months
export const MIN_SUBSCRIPTION_MONTHS = 1

// Pause limits
export const MAX_PAUSE_DAYS_PER_MONTH = 5

// ==================== TIMING CONSTANTS ====================

// Cutoff time for changes (5:00 PM IST previous day)
export const CUTOFF_HOUR = 17 // 5 PM in 24-hour format
export const CUTOFF_MINUTE = 0

// Delivery time
export const DELIVERY_HOUR = 6 // 6 AM

// Grace period for negative balance
export const GRACE_PERIOD_DAYS = 1

// Penalty trigger (days without returning bottles)
export const PENALTY_TRIGGER_DAYS = 7

// ==================== TIMEZONE ====================

export const TIMEZONE = 'Asia/Kolkata'

// ==================== BOTTLE COMPOSITION ====================

// Helper to calculate bottle composition from quantity
export function calculateBottleComposition(quantityMl: number): {
  largeBottles: number
  smallBottles: number
} {
  const largeBottles = Math.floor(quantityMl / 1000)
  const remainingMl = quantityMl % 1000
  const smallBottles = remainingMl >= 500 ? 1 : 0
  
  return { largeBottles, smallBottles }
}

// Helper to calculate daily price from quantity
export function calculateDailyPrice(quantityMl: number): number {
  const { largeBottles, smallBottles } = calculateBottleComposition(quantityMl)
  return (largeBottles * MILK_PRICE_PER_LITER_PAISE) + (smallBottles * MILK_PRICE_PER_500ML_PAISE)
}

// Helper to calculate deposit amount
export function calculateDepositAmount(quantityMl: number): number {
  const { largeBottles, smallBottles } = calculateBottleComposition(quantityMl)
  return (largeBottles * DEPOSIT_LARGE_BOTTLE_PAISE) + (smallBottles * DEPOSIT_SMALL_BOTTLE_PAISE)
}

// Helper to calculate monthly total (milk + deposit if applicable)
export function calculateMonthlyTotal(
  quantityMl: number,
  daysInMonth: number,
  includeDeposit: boolean
): { milkTotal: number; depositTotal: number; grandTotal: number } {
  const dailyPrice = calculateDailyPrice(quantityMl)
  const milkTotal = dailyPrice * daysInMonth
  const depositTotal = includeDeposit ? calculateDepositAmount(quantityMl) : 0
  
  return {
    milkTotal,
    depositTotal,
    grandTotal: milkTotal + depositTotal
  }
}

// Check if deposit is due for a given cycle
export function isDepositDue(paymentCycleCount: number): boolean {
  // Deposit on month 1, 4, 7, 10... (every 3 months)
  return paymentCycleCount % DEPOSIT_CYCLE_MONTHS === 1
}

// ==================== QUANTITY OPTIONS ====================

export const QUANTITY_OPTIONS = [
  { value: 500, label: '500ml', bottles: '1 small bottle' },
  { value: 1000, label: '1 Liter', bottles: '1 large bottle' },
  { value: 1500, label: '1.5 Liters', bottles: '1 large + 1 small bottle' },
  { value: 2000, label: '2 Liters', bottles: '2 large bottles' },
  { value: 2500, label: '2.5 Liters', bottles: '2 large + 1 small bottle' },
  { value: 3000, label: '3 Liters', bottles: '3 large bottles' },
]

// ==================== STATUS LABELS ====================

export const CUSTOMER_STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending Approval',
  PENDING_PAYMENT: 'Awaiting Payment',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  BLOCKED: 'Blocked',
  INACTIVE: 'Inactive',
}

export const DELIVERY_STATUS_LABELS = {
  SCHEDULED: 'Scheduled',
  DELIVERED: 'Delivered',
  NOT_DELIVERED: 'Not Delivered',
  PAUSED: 'Paused',
  BLOCKED: 'Blocked',
  HOLIDAY: 'Holiday',
}

// ==================== FORMAT HELPERS ====================

export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function formatQuantity(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${liters}L`
  }
  return `${ml}ml`
}

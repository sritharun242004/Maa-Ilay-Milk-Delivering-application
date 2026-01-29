import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { TIMEZONE, CUTOFF_HOUR, CUTOFF_MINUTE } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get current date in IST
export function getISTDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }))
}

// Get IST date string (YYYY-MM-DD)
export function getISTDateString(date?: Date): string {
  const d = date || new Date()
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE }) // en-CA gives YYYY-MM-DD format
}

// Parse date string to Date object (assumes IST)
export function parseISTDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Check if current time is past cutoff (5 PM IST)
export function isPastCutoff(): boolean {
  const now = getISTDate()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  return currentHour > CUTOFF_HOUR || (currentHour === CUTOFF_HOUR && currentMinute >= CUTOFF_MINUTE)
}

// Get the earliest date that can be paused (considering cutoff)
export function getEarliestPausableDate(): Date {
  const today = getISTDate()
  today.setHours(0, 0, 0, 0)
  
  // If past cutoff, can't pause tomorrow, only day after
  const daysToAdd = isPastCutoff() ? 2 : 1
  today.setDate(today.getDate() + daysToAdd)
  
  return today
}

// Get tomorrow's date in IST
export function getTomorrowIST(): Date {
  const tomorrow = getISTDate()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow
}

// Get current month-year string (YYYY-MM)
export function getCurrentMonthYear(): string {
  const now = getISTDate()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Get days in a specific month
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Get start and end of current month
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = getISTDate()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start, end }
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE
  })
}

// Format date for display (short)
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: TIMEZONE
  })
}

// Format datetime for display
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE
  })
}

// Generate array of dates for a month
export function getMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = []
  const daysInMonth = getDaysInMonth(year, month)
  
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month - 1, day))
  }
  
  return dates
}

// Check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

// Calculate difference in days between two dates
export function daysDifference(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((date2.getTime() - date1.getTime()) / oneDay)
}

// Validate phone number (Indian format)
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(cleaned)
}

// Format phone number for display
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  return phone
}

// Validate pincode (Indian format)
export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode)
}

// Generate a random password
export function generatePassword(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Slugify a string
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

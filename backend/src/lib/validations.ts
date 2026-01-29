import { z } from "zod"
import { 
  MIN_DAILY_QUANTITY_ML, 
  MAX_DAILY_QUANTITY_ML, 
  QUANTITY_STEP_ML 
} from "./constants"

// Customer registration schema
export const customerRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  addressLine1: z.string().min(5, "Address must be at least 5 characters"),
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().default("Pondicherry"),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Please enter a valid 6-digit pincode"),
})

// Subscription schema
export const subscriptionSchema = z.object({
  dailyQuantityMl: z
    .number()
    .min(MIN_DAILY_QUANTITY_ML, `Minimum quantity is ${MIN_DAILY_QUANTITY_ML}ml`)
    .max(MAX_DAILY_QUANTITY_ML, `Maximum quantity is ${MAX_DAILY_QUANTITY_ML}ml`)
    .refine(
      (val) => val % QUANTITY_STEP_ML === 0,
      `Quantity must be in steps of ${QUANTITY_STEP_ML}ml`
    ),
})

// Pause request schema
export const pauseRequestSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")),
})

// Wallet top-up schema
export const walletTopupSchema = z.object({
  amountPaise: z.number().min(10000, "Minimum top-up is ₹100").max(5000000, "Maximum top-up is ₹50,000"),
})

// Admin - Create delivery person schema
export const createDeliveryPersonSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"),
  zone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

// Admin - Approve customer schema
export const approveCustomerSchema = z.object({
  customerId: z.string(),
  deliveryPersonId: z.string(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
})

// Admin - Wallet adjustment schema
export const walletAdjustmentSchema = z.object({
  customerId: z.string(),
  amountPaise: z.number(),
  description: z.string().min(3, "Description is required"),
  type: z.enum(["ADMIN_CREDIT", "ADMIN_DEBIT"]),
})

// Delivery - Mark delivery schema
export const markDeliverySchema = z.object({
  deliveryId: z.string(),
  status: z.enum(["DELIVERED", "NOT_DELIVERED"]),
  largeBottlesCollected: z.number().min(0).default(0),
  smallBottlesCollected: z.number().min(0).default(0),
  notes: z.string().optional(),
})

// Admin login schema
export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

// Admin - Create admin schema
export const createAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
})

// Inventory update schema
export const inventoryUpdateSchema = z.object({
  largeBottlesDelta: z.number().default(0),
  smallBottlesDelta: z.number().default(0),
  reason: z.string().min(3, "Reason is required"),
})

// Holiday schema
export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  reason: z.string().min(3, "Reason is required"),
})

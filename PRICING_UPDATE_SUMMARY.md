# Pricing Update Summary

## New Pricing Structure

All pricing has been updated to reflect volume-based discounts:

| Quantity | Old Price | New Price | Change |
|----------|-----------|-----------|--------|
| 500ml    | ₹68/day   | ₹68/day   | No change |
| 1L       | ₹110/day  | ₹110/day  | No change |
| 1.5L     | ₹178/day  | ₹165/day  | **-₹13/day (7% discount)** |
| 2L       | ₹220/day  | ₹215/day  | **-₹5/day (2% discount)** |
| 2.5L     | ₹288/day  | ₹268/day  | **-₹20/day (7% discount)** |
| 3L+      | Available | **REMOVED** | Max quantity now 2.5L |

## Files Updated

### Backend Changes

1. **`backend-express/src/config/pricing.ts`**
   - ✅ Updated `ALLOWED_DAILY_QUANTITIES_ML` to `[500, 1000, 1500, 2000, 2500]`
   - ✅ Added `DAILY_PRICE_MAP_PAISE` lookup table
   - ✅ Added `DAILY_PRICE_MAP_RS` lookup table
   - ✅ Updated `calculateDailyPricePaise()` to use lookup table
   - ✅ Added new `calculateDailyPriceRs()` function

2. **`backend-express/src/config/constants.ts`**
   - ✅ Updated `QUANTITY.MAX_ML` from 10000 to 2500
   - ✅ Added `STANDARD_2L` and `STANDARD_2_5L` constants

3. **`backend-express/src/routes/customer.ts`**
   - ✅ Imported new pricing functions
   - ✅ Updated dashboard endpoint to use `calculateDailyPriceRs()`
   - ✅ Updated subscribe endpoint to use pricing lookup
   - ✅ Removed manual price calculations

### Frontend Changes

1. **`frontend/src/config/pricing.ts`**
   - ✅ Added `DAILY_PRICE_MAP` with new pricing
   - ✅ Updated `DAILY_QUANTITY_OPTIONS` to only include up to 2.5L
   - ✅ Removed 3L, 3.5L, 4L options
   - ✅ Updated pricing to include volume discounts

2. **`frontend/src/pages/customer/Subscription.tsx`**
   - ✅ Updated description text from "0.5L to 4L" to "0.5L to 2.5L"
   - ✅ Fixed hardcoded "Current Plan" section
   - ✅ Now fetches real subscription data from API

3. **`frontend/src/pages/customer/Dashboard.tsx`**
   - ✅ Fixed subscription display for users without subscriptions
   - ✅ Added warning banner for new users

## Logic Updates

### Wallet Deduction Logic
- ✅ Uses `calculateDailyPricePaise()` which now uses lookup table
- ✅ Delivery marking automatically calculates correct price
- ✅ No manual calculations - all use centralized pricing function

### Admin Panel
- ✅ Displays real-time pricing from backend API
- ✅ No hardcoded values
- ✅ Automatically shows new pricing

### Delivery Person Panel
- ✅ Displays quantities dynamically
- ✅ Wallet deductions calculated on backend
- ✅ No frontend pricing logic

## Testing Checklist

### Customer Flow
- [ ] New subscription: Select 1.5L → Should show ₹165/day (not ₹178)
- [ ] New subscription: Select 2L → Should show ₹215/day (not ₹220)
- [ ] New subscription: Select 2.5L → Should show ₹268/day (not ₹288)
- [ ] Verify quantities above 2.5L are not available
- [ ] Dashboard shows correct daily price for subscription

### Delivery Person Flow
- [ ] Mark delivery as delivered for 1.5L customer → Deduct ₹165
- [ ] Mark delivery as delivered for 2L customer → Deduct ₹215
- [ ] Mark delivery as delivered for 2.5L customer → Deduct ₹268
- [ ] Check wallet transaction history shows correct amounts

### Admin Panel
- [ ] Customer list shows correct subscription prices
- [ ] Revenue calculations reflect new pricing
- [ ] Delivery charges are correct

## Pricing Formula

**Old Formula (Additive):**
- Price = (Large Bottles × ₹110) + (Small Bottles × ₹68)
- Example: 2.5L = 2×₹110 + 1×₹68 = ₹288

**New Formula (Lookup Table with Volume Discounts):**
- Uses `DAILY_PRICE_MAP` for exact pricing
- Includes volume discounts
- Example: 2.5L = ₹268 (₹20 discount)

## Migration Notes

### Existing Customers
- Existing subscriptions retain their current pricing
- To update existing customer to new pricing:
  1. Customer modifies subscription on subscription page
  2. New price applies from next billing cycle

### Database
- No schema changes required
- `dailyPricePaise` field stores exact price
- `dailyQuantityMl` field remains same

## API Endpoints Affected

All endpoints use `calculateDailyPricePaise()`:
- ✅ `POST /api/customer/subscribe`
- ✅ `GET /api/customer/dashboard`
- ✅ `POST /api/customer/calendar/modify`
- ✅ `PATCH /api/delivery/:id/mark`
- ✅ `POST /api/admin/deliveries/assign`

## Volume Discounts Summary

- **1.5L**: 7% discount (₹13 savings per day = ₹390/month)
- **2L**: 2% discount (₹5 savings per day = ₹150/month)
- **2.5L**: 7% discount (₹20 savings per day = ₹600/month)

## Next Steps

1. Test all user flows with new pricing
2. Verify wallet deductions are correct
3. Check admin revenue reports
4. Update any customer-facing documentation
5. Communicate pricing changes to existing customers (if needed)

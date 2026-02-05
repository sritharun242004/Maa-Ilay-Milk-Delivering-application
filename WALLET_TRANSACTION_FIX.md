# Wallet Transaction History Fix

## Problem Identified

**Issue**: Wallet balance calculations appeared incorrect, showing extra money (₹122.22) after top-ups.

**Root Cause**:
1. The seed script created wallets with initial balances (₹150) but did NOT create corresponding `WalletTransaction` records
2. This created "phantom" money in wallets with no transaction history to explain where it came from
3. Users seeing the transaction list would not see any record of the initial balance
4. Additionally, seed was using outdated pricing (₹220 for 2L instead of ₹215)

## Example from Screenshot
- User topped up ₹2500
- Expected balance: ₹2500
- Actual balance: ₹2622.22
- Extra amount: ₹122.22 (from previous unrecorded balance or transactions)

## Fixes Applied

### 1. Fixed Seed Script (`prisma/seed.ts`)

**Changes:**
- Now creates a `WalletTransaction` record for the initial ₹150 seed balance
- Uses correct pricing from `pricing.ts` configuration
- Transaction includes:
  - Type: `WALLET_TOPUP`
  - Amount: 15000 paise (₹150)
  - Description: "Initial seed balance"
  - Reference: `SEED_{customerId}`

**Before:**
```typescript
await prisma.wallet.upsert({
  where: { customerId: customer.id },
  create: {
    customerId: customer.id,
    balancePaise: 15000,  // ❌ No transaction record!
  },
})
```

**After:**
```typescript
const wallet = await prisma.wallet.upsert({
  where: { customerId: customer.id },
  create: {
    customerId: customer.id,
    balancePaise: 15000,
  },
})

// ✅ Create transaction record for the seed balance
await prisma.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: 'WALLET_TOPUP',
    amountPaise: 15000,
    balanceAfterPaise: 15000,
    description: 'Initial seed balance',
    referenceType: 'seed',
    referenceId: `SEED_${customer.id}`
  }
})
```

### 2. Fixed Pricing in Seed

**Before:** Used hardcoded old prices
- 1L: ₹110 (correct)
- 2L: ₹220 (incorrect - should be ₹215)

**After:** Uses `calculateDailyPricePaise()` from `pricing.ts`
- 1L: ₹110 ✓
- 2L: ₹215 ✓
- All quantities use correct pricing with volume discounts

### 3. Created Migration Script

**File:** `src/scripts/fixWalletTransactionHistory.ts`
**Command:** `npm run fix-wallet-history`

**What it does:**
- Scans all wallets for unrecorded initial balances
- Creates "Initial balance (from seed/migration)" transactions for wallets with balance but no transactions
- Creates adjustment transactions for wallets where transaction history doesn't match current balance
- Backdates transactions by 30 days to appear before other transactions

## Critical Rule Going Forward

**EVERY wallet balance change MUST have a corresponding WalletTransaction record.**

### Where Transactions Are Created:

1. **Wallet Top-up** (`customer.ts:408`)
   - Type: `WALLET_TOPUP`
   - Amount: positive (added to wallet)

2. **Milk Charge** (`delivery.ts:771`)
   - Type: `MILK_CHARGE`
   - Amount: negative (deducted from wallet)

3. **Bottle Deposit Charge** (`admin.ts:570`, `delivery.ts:705`)
   - Type: `DEPOSIT_CHARGE`
   - Amount: negative (deducted from wallet)

4. **Penalty Charge** (`penaltyService.ts:139`, `penaltyService.ts:413`)
   - Type: `PENALTY_CHARGE`
   - Amount: negative (deducted from wallet)

5. **Initial Seed Balance** (`seed.ts` - NEW!)
   - Type: `WALLET_TOPUP`
   - Amount: positive (initial balance)
   - Reference: `SEED_{customerId}`

## Testing

After applying fixes:
1. ✅ Wallet transaction query returns last 50 transactions
2. ✅ Initial seed balance now appears in transaction history
3. ✅ All balance changes are traceable
4. ✅ Correct pricing (₹215 for 2L, not ₹220)

## Future Considerations

1. **Transaction History Limit**: Currently showing last 50 transactions
   - Consider pagination if customers have more than 50 transactions
   - Add "Load more" functionality if needed

2. **Balance Verification**: Add a daily job to verify:
   ```
   wallet.balancePaise === last_transaction.balanceAfterPaise
   ```

3. **Audit Trail**: All financial transactions now have:
   - Timestamp (`createdAt`)
   - Type (clear category)
   - Amount (with sign)
   - Balance after (for verification)
   - Description (human-readable)
   - Reference (traceability)

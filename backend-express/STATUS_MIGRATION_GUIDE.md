# Customer Status Migration Guide

## Issue

After fixing the status calculation logic, existing customers still have old statuses in the database. The admin dashboard only shows "Active" and "Pending Approval" but customers with negative balances should show "INACTIVE" and customers with future pauses should show "PAUSED".

## Solution

Run the status recalculation script to update all customer statuses based on the new business logic.

---

## How to Run

### Step 1: Stop the backend server (if running)
```bash
# Press Ctrl+C in the terminal running the backend
```

### Step 2: Run the migration script
```bash
cd backend-express
npm run recalculate-statuses
```

### Step 3: Review the output
The script will show:
- Total customers processed
- Number of statuses changed
- Detailed list of changes
- Summary grouped by change type

### Step 4: Restart the backend
```bash
npm run dev
```

### Step 5: Refresh the admin dashboard
- Open browser: http://localhost:5173/admin/customers
- Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) to hard refresh
- You should now see INACTIVE and PAUSED statuses

---

## Expected Output

```
Starting status recalculation for all customers...

Found 15 customers to process

✓ Bala Krishnan: ACTIVE → PAUSED
✓ Amit Kumar: ACTIVE → INACTIVE
✓ Dev Menon: ACTIVE → INACTIVE
✓ Priya Sharma: ACTIVE → ACTIVE

============================================================
SUMMARY
============================================================
Total customers: 15
Updated: 8
Unchanged: 7
============================================================

DETAILED CHANGES:
============================================================

ACTIVE → PAUSED (3 customers):
  - Bala Krishnan (bala@example.com)
  - Ravi Chandran (ravi@example.com)
  - Sneha Pillai (sneha@example.com)

ACTIVE → INACTIVE (5 customers):
  - Amit Kumar (amit@example.com)
  - Dev Menon (dev@example.com)
  - Anita Rao (anita@example.com)
  - Lakshmi Devi (lakshmi@example.com)
  - Ekta Singh (ekta@example.com)

✅ Status recalculation completed successfully!

Script finished. You can now refresh the admin dashboard.
```

---

## What Gets Updated

### Status Rules (New Logic)

1. **VISITOR**
   - Customer logged in but hasn't subscribed yet
   - No subscription record exists

2. **PENDING_APPROVAL**
   - Customer subscribed but no delivery person assigned
   - Subscription exists, deliveryPersonId is NULL

3. **PAUSED**
   - Customer has future pause dates (today or later)
   - Has subscription + delivery person + pause records

4. **INACTIVE**
   - Customer has delivery person but insufficient wallet balance
   - Balance below grace limit (can go negative up to 1 day's charge)

5. **ACTIVE**
   - Customer has delivery person + sufficient wallet balance
   - No active pauses for today or future

### Grace Period Calculation
```typescript
const dailyCharge = subscription.dailyPricePaise;
const graceLimitPaise = -dailyCharge; // Can go 1 day negative

if (walletBalance >= graceLimitPaise) {
  status = 'ACTIVE';
} else {
  status = 'INACTIVE';
}
```

---

## Common Scenarios

### Scenario 1: Customer with Negative Balance
**Before:** Status = ACTIVE
**After:** Status = INACTIVE
**Reason:** Wallet balance below grace limit

### Scenario 2: Customer with Future Pauses
**Before:** Status = ACTIVE
**After:** Status = PAUSED
**Reason:** Has pause dates in calendar (today onwards)

### Scenario 3: Customer Recently Topped Up
**Before:** Status = INACTIVE
**After:** Status = ACTIVE
**Reason:** Wallet balance now above grace limit

### Scenario 4: Customer Not Yet Approved
**Before:** Status = VISITOR or ACTIVE
**After:** Status = PENDING_APPROVAL
**Reason:** Has subscription but no delivery person assigned

---

## Troubleshooting

### Issue: Script shows "0 customers updated"
**Possible Causes:**
1. All statuses are already correct
2. No customers in database
3. Database connection issue

**Solution:**
Check database connection in `.env` file

### Issue: Script fails with "Customer not found"
**Cause:** Customer record was deleted mid-execution
**Solution:** Re-run the script

### Issue: Status still shows wrong after refresh
**Causes:**
1. Browser cache not cleared
2. Frontend not fetching latest data
3. Backend not restarted

**Solution:**
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear browser cache completely
3. Restart backend server

---

## Verification Checklist

After running the script:

- [ ] Script completed without errors
- [ ] Summary shows updated customer count
- [ ] Backend restarted successfully
- [ ] Admin dashboard hard-refreshed
- [ ] Can now see INACTIVE customers (with negative balance)
- [ ] Can now see PAUSED customers (with future pause dates)
- [ ] PENDING_APPROVAL customers visible (no delivery person)
- [ ] Status filter dropdown shows all 5 statuses

---

## Manual Verification

### Check Individual Customer Status

1. **Find customer with negative balance:**
   ```bash
   # In PostgreSQL or Prisma Studio
   SELECT c.name, c.status, w."balancePaise"
   FROM "Customer" c
   LEFT JOIN "Wallet" w ON w."customerId" = c.id
   WHERE w."balancePaise" < 0;
   ```
   Expected: Status should be INACTIVE

2. **Find customer with future pauses:**
   ```bash
   SELECT c.name, c.status, COUNT(p.id) as pause_count
   FROM "Customer" c
   LEFT JOIN "Pause" p ON p."customerId" = c.id
   WHERE p."pauseDate" >= CURRENT_DATE
   GROUP BY c.id, c.name, c.status
   HAVING COUNT(p.id) > 0;
   ```
   Expected: Status should be PAUSED

---

## Performance

- **Speed:** ~50 customers per second
- **Memory:** Minimal (processes one at a time)
- **Database Load:** Low (simple UPDATE queries)
- **Downtime Required:** No (but recommended to stop backend for clean execution)

---

## Rollback

If statuses are incorrect after migration:

1. **Stop the backend**
2. **Restore from database backup** (if available)
3. **Or re-run the script** (it's idempotent - safe to run multiple times)

---

## Safety

✅ **Safe to run multiple times** - Script is idempotent
✅ **No data loss** - Only updates status field
✅ **Reversible** - Can re-run or restore from backup
✅ **Read-mostly** - Only writes to Customer.status field
✅ **Atomic** - Each customer update is a separate transaction

---

## When to Run This Script

Run this migration script when:
- ✅ After deploying status calculation fixes
- ✅ When customers show wrong statuses in admin dashboard
- ✅ After fixing bugs in statusManager.ts logic
- ✅ When onboarding new customers (optional, status is set correctly on creation)
- ❌ Not needed in normal operation (status updates automatically)

---

## Support

If you encounter issues:
1. Check the error message in console
2. Verify database connection
3. Check if backend is stopped before running
4. Review the output summary for clues

---

**Ready to run?**
```bash
cd backend-express
npm run recalculate-statuses
```

Then refresh the admin dashboard to see updated statuses!

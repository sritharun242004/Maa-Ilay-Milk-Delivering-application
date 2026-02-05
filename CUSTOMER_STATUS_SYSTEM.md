# Customer Status System - 4 Statuses

## Overview

The system now has **4 distinct statuses** to track customer subscription lifecycle:

---

## Status Definitions

### 1. 🔵 PENDING (Database: `PENDING_PAYMENT`)
**When:** New user completed profile but hasn't subscribed yet

**Conditions:**
- Customer status = `PENDING_PAYMENT`
- No subscription created

**Dashboard Display:**
- Badge: 🔴 Red (error)
- Label: "Pending"
- Subtext: "Complete subscription"
- Next Delivery: "—" with subtext "Complete subscription first"
- Banner: Blue info box with "Complete Your Subscription" button

**User Action Required:** Go to Subscription page and select daily quantity

---

### 2. 🟡 WAITING FOR APPROVAL (Database: `PENDING_APPROVAL`)
**When:** User subscribed but admin hasn't assigned delivery person yet

**Conditions:**
- Customer status = `PENDING_APPROVAL`
- Subscription exists
- No delivery person assigned (`deliveryPersonId = null`)

**Dashboard Display:**
- Badge: 🟡 Yellow (warning)
- Label: "Waiting for Approval"
- Subtext: "Awaiting admin assignment"
- Next Delivery: "—" with subtext "Waiting for admin approval"
- Banner: Yellow info box explaining admin will assign delivery person

**Admin Action Required:** Assign delivery person in admin panel

---

### 3. 🟢 ACTIVE (Database: `ACTIVE`)
**When:** Full subscription active with deliveries happening

**Conditions:**
- Customer status = `ACTIVE`
- Subscription exists
- Delivery person assigned (`deliveryPersonId != null`)
- Sufficient wallet balance (≥ 1 day's milk charge)

**Dashboard Display:**
- Badge: 🟢 Green (success)
- Label: "Active"
- Subtext: None (or "1 day grace period" if low balance)
- Next Delivery: Shows actual date (e.g., "Tomorrow") with "6:00 AM"
- No banner

---

### 4. 🔴 INACTIVE (Database: `ACTIVE` + Display: `INACTIVE`)
**When:** Subscription exists but out of balance

**Conditions:**
- Customer status = `ACTIVE`
- Subscription exists
- Delivery person assigned
- Insufficient wallet balance (< 1 day's milk charge)

**Dashboard Display:**
- Badge: 🔴 Red (error)
- Label: "Inactive"
- Subtext: None
- Next Delivery: "—" (no delivery scheduled due to insufficient funds)
- Banner: Orange warning to add money to wallet

**User Action Required:** Add money to wallet

---

## Status Transitions

```
User Signs Up
    ↓
Completes Onboarding
    ↓
Status: PENDING_PAYMENT 🔵
Dashboard: "Pending" - Blue banner "Complete Your Subscription"
    ↓
User Subscribes (Selects Quantity)
    ↓
Status: PENDING_APPROVAL 🟡
Dashboard: "Waiting for Approval" - Yellow banner "Waiting for Admin Approval"
    ↓
Admin Assigns Delivery Person
    ↓
Status: ACTIVE 🟢
    ├─ Sufficient Balance → Display: "Active" ✅
    │   Dashboard: Normal active view, next delivery shown
    │
    └─ Insufficient Balance → Display: "Inactive" ❌
        Dashboard: "Inactive" - Orange warning to add money
```

---

## Backend Implementation

### Onboarding Endpoint (`POST /api/customer/complete-profile`)
```typescript
// Sets customer status to PENDING_PAYMENT
data: {
  ...sanitized,
  status: 'PENDING_PAYMENT'
}
```

### Subscription Endpoint (`POST /api/customer/subscribe`)
```typescript
// Changes status from PENDING_PAYMENT to PENDING_APPROVAL
if (customer.status === 'PENDING_PAYMENT') {
  await prisma.customer.update({
    data: { status: 'PENDING_APPROVAL' }
  });
}
```

### Admin Assignment Endpoint (`PATCH /api/admin/customers/:id`)
```typescript
// Changes status from PENDING_APPROVAL to ACTIVE when delivery person assigned
if (existing.status === 'PENDING_APPROVAL' && deliveryPersonId) {
  data.status = 'ACTIVE';
}
```

### Dashboard Endpoint (`GET /api/customer/dashboard`)
```typescript
// Returns null for subscriptionStatusDisplay if:
// - Customer is PENDING_PAYMENT or PENDING_APPROVAL
// - No delivery person assigned
const hasDeliveryPerson = !!customer.deliveryPersonId;
const isPendingApproval = customer.status === 'PENDING_APPROVAL';

const subscriptionStatusDisplayValue = sub && hasDeliveryPerson && !isPendingApproval
  ? subscriptionStatusDisplay(walletBalanceRs, dailyRs, isTomorrowPaused)
  : null;
```

---

## Frontend Implementation

### Dashboard Status Display
```typescript
const customerStatus = data?.customer?.status;
const isPendingPayment = customerStatus === 'PENDING_PAYMENT';
const isPendingApproval = customerStatus === 'PENDING_APPROVAL';

const subscriptionLabel = isPendingPayment
  ? 'Pending'
  : isPendingApproval
  ? 'Waiting for Approval'
  : /* ... Active/Inactive/Paused based on subscriptionStatusDisplay */
```

---

## Maintenance Script

**Fix users with incorrect status:**
```bash
cd backend-express
npx tsx scripts/fix-pending-users.ts
```

This script finds customers with subscriptions but no delivery person and sets their status to `PENDING_APPROVAL`.

---

## Summary Table

| Status | DB Value | Has Subscription | Has Delivery Person | Has Balance | Badge Color | User Action | Admin Action |
|--------|----------|------------------|---------------------|-------------|-------------|-------------|--------------|
| **Pending** | PENDING_PAYMENT | ❌ No | ❌ No | - | 🔴 Red | Subscribe | - |
| **Waiting for Approval** | PENDING_APPROVAL | ✅ Yes | ❌ No | - | 🟡 Yellow | Wait | Assign delivery person |
| **Active** | ACTIVE | ✅ Yes | ✅ Yes | ✅ Yes | 🟢 Green | - | - |
| **Inactive** | ACTIVE | ✅ Yes | ✅ Yes | ❌ No | 🔴 Red | Add money | - |

---

**Last Updated:** 2026-02-04

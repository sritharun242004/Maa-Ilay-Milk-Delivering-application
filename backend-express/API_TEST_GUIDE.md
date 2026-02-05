# API Testing Guide - Maa Ilay Milk Delivery System

**Last Updated:** 2026-02-05
**System Version:** v2.0 (Post-Audit)

---

## Overview

This document provides comprehensive testing procedures for all API endpoints after the system audit and optimization.

## Changes Summary

### Error Handling (New)
- ✅ Standardized error responses with error codes
- ✅ User-friendly error messages
- ✅ Detailed error context in development

### Error Response Format
```json
{
  "code": "WAL_001",
  "message": "Insufficient wallet balance",
  "details": {
    "required": 50,
    "available": 30,
    "shortfall": 20
  },
  "timestamp": "2026-02-05T10:30:00.000Z"
}
```

---

## Test Scenarios

### 1. Customer Onboarding Flow

#### 1.1 Google Sign-Up → VISITOR Status
```bash
# After Google OAuth, check customer status
GET /api/customer/dashboard
Expected Status: VISITOR
Expected Response: No subscription data
```

#### 1.2 Complete Profile
```bash
POST /api/customer/complete-profile
Content-Type: application/json

{
  "name": "Test Customer",
  "phone": "9876543210",
  "addressLine1": "123 Test Street",
  "city": "Pondicherry",
  "pincode": "605001"
}

Expected:
- Status: VISITOR (remains same)
- Profile fields saved
```

#### 1.3 Subscribe → PENDING_APPROVAL
```bash
POST /api/customer/subscribe
Content-Type: application/json

{
  "dailyQuantityMl": 1000
}

Expected:
- Status changes: VISITOR → PENDING_APPROVAL
- Wallet created with ₹0 balance
- Subscription created
```

#### 1.4 Admin Assignment → ACTIVE/INACTIVE
```bash
PATCH /api/admin/customers/:id
Content-Type: application/json

{
  "deliveryPersonId": "dp_xxx",
  "deliveryStartDate": "2026-02-06"
}

Expected:
- Bottle deposit charged (₹70 for 1L)
- Status: ACTIVE (if balance >= 0) or INACTIVE (if balance < grace limit)
- deliveryStartDate set
```

### 2. Wallet Operations

#### 2.1 Top-Up (Valid)
```bash
POST /api/customer/wallet/topup
Content-Type: application/json

{
  "amountRs": 500
}

Expected:
- Balance increases by ₹500
- Transaction created with type: WALLET_TOPUP
- If was INACTIVE, status → ACTIVE
```

#### 2.2 Top-Up (Invalid Amount)
```bash
POST /api/customer/wallet/topup
Content-Type: application/json

{
  "amountRs": 5
}

Expected Error:
- Code: VAL_004 (INVALID_AMOUNT)
- Message: "Invalid amount. Minimum top-up is ₹10"
- HTTP 400
```

#### 2.3 Check Balance
```bash
GET /api/customer/wallet

Expected Response:
{
  "balancePaise": 50000,
  "balanceRs": "500.00",
  "transactions": [...]
}
```

### 3. Delivery Operations

#### 3.1 Pause Tomorrow (Before 5 PM)
```bash
POST /api/customer/calendar/pause
Content-Type: application/json

{
  "date": "2026-02-06"
}

Expected:
- Pause record created
- Delivery status → PAUSED
- Customer status → PAUSED (if checking today/tomorrow)
```

#### 3.2 Pause Tomorrow (After 5 PM) - Should Fail
```bash
# Run this after 5 PM IST
POST /api/customer/calendar/pause
Content-Type: application/json

{
  "date": "2026-02-06"
}

Expected Error:
- Code: DEL_005 (CUTOFF_TIME_EXCEEDED)
- Message: "Cannot modify tomorrow's delivery after 5 PM"
- HTTP 400
```

#### 3.3 Mark Delivery as Delivered
```bash
PATCH /api/delivery/:id/mark
Content-Type: application/json

{
  "status": "DELIVERED",
  "largeBottlesCollected": 2,
  "smallBottlesCollected": 0
}

Expected:
- Delivery status → DELIVERED
- Wallet charged (daily price)
- Bottle ledger updated:
  * ISSUED: +bottles delivered
  * RETURNED: -bottles collected
- Delivery count incremented
- Check deposit at 90, 180, 270... deliveries
```

#### 3.4 Mark Delivery (Insufficient Balance) - Should Fail
```bash
# Customer with balance = -₹90, daily charge = ₹30
# Absolute minimum = -₹90 (3 days)
PATCH /api/delivery/:id/mark
Content-Type: application/json

{
  "status": "DELIVERED"
}

Expected Error:
- Code: WAL_005 (WALLET_BELOW_MINIMUM)
- Message: "Cannot charge delivery: wallet would exceed maximum negative balance"
- Details include current balance, charge, minimum
- HTTP 400
```

### 4. Bottle Management

#### 4.1 Collect More Bottles Than Available - Should Fail
```bash
# Customer has 2 large bottles
PATCH /api/delivery/:id/mark
Content-Type: application/json

{
  "largeBottlesCollected": 5
}

Expected Error:
- Code: BOT_001 (BOTTLE_COLLECTION_EXCEEDS_BALANCE)
- Message: "Cannot collect 5 large bottles. Customer only has 2 bottles."
- Details: { requested: 5, available: 2, type: "large" }
- HTTP 400
```

#### 4.2 Check Bottle Balance
```bash
GET /api/customer/history/bottles

Expected Response:
{
  "totalIssued": 120,
  "totalCollected": 100,
  "withCustomer": 20,
  "entries": [...]
}
```

### 5. Admin Operations

#### 5.1 Get Customer Details
```bash
GET /api/admin/customers/:id

Expected Response:
{
  "customer": {...},
  "wallet": {...},
  "subscription": {...},
  "bottleBalance": { large: 2, small: 1 },
  "calendar": {...}
}
```

#### 5.2 Assign Delivery Person (Insufficient Balance for Deposit)
```bash
# Customer has ₹50 balance, deposit required ₹70
PATCH /api/admin/customers/:id
Content-Type: application/json

{
  "deliveryPersonId": "dp_xxx"
}

Expected Error:
- Code: WAL_001 (INSUFFICIENT_BALANCE)
- Message: "Insufficient wallet balance for bottle deposit"
- Details: { required: 70, available: 50, shortfall: 20 }
- HTTP 400
```

### 6. Status Transitions

#### 6.1 Full Customer Lifecycle
```
1. Google Sign-Up → VISITOR
2. Complete Profile → VISITOR (stays)
3. Subscribe → PENDING_APPROVAL
4. Admin Assigns DP + Balance OK → ACTIVE
5. Balance Drops Below Grace → INACTIVE
6. Customer Tops Up → ACTIVE
7. Customer Pauses → PAUSED
8. Customer Resumes → ACTIVE
```

#### 6.2 Automatic Status Updates
Test that status updates automatically after:
- Wallet top-up
- Delivery charge
- Admin assignment/unassignment
- Pause/resume actions

### 7. Bottle Deposit System

#### 7.1 First Deposit (On Assignment)
```bash
# New customer with 1L subscription
# Balance: ₹100

PATCH /api/admin/customers/:customerId
{
  "deliveryPersonId": "dp_xxx"
}

Expected:
- Deposit charged: ₹70 (2×₹35 for 1L bottles)
- New balance: ₹30
- lastDepositAtDelivery: 0
- lastDepositChargedAt: current timestamp
```

#### 7.2 Recurring Deposits (Every 90 Deliveries)
```bash
# Customer at 89 deliveries
PATCH /api/delivery/:id/mark
{ "status": "DELIVERED" }

Expected:
- Delivery count: 90
- Deposit charged: ₹70
- lastDepositAtDelivery: 90
- Wallet transaction created
```

Test at: 90, 180, 270, 360... deliveries

### 8. Date Handling (IST Timezone)

#### 8.1 5 PM Cutoff (IST)
```bash
# At 16:59 IST (4:59 PM)
POST /api/customer/calendar/pause
{ "date": "tomorrow" }
Expected: SUCCESS

# At 17:00 IST (5:00 PM)
POST /api/customer/calendar/pause
{ "date": "tomorrow" }
Expected: ERROR (DEL_005)
```

#### 8.2 Delivery Start Date
```bash
# Admin sets deliveryStartDate to 2026-02-10
# Check that no deliveries show before this date
GET /api/delivery/today?date=2026-02-09
Expected: Customer NOT in list

GET /api/delivery/today?date=2026-02-10
Expected: Customer IN list
```

### 9. Performance Tests

#### 9.1 Response Compression
```bash
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/customer/dashboard

Expected:
- Content-Encoding: gzip
- Response size 60-70% smaller
```

#### 9.2 Query Optimization (No N+1)
```bash
# Enable query logging in Prisma
# Check delivery person's today's deliveries
GET /api/delivery/today

Expected:
- Single query for deliveries with includes
- Batch query for bottle ledgers
- No loop queries
```

### 10. Error Codes Reference

| Code | Error | Test Scenario |
|------|-------|---------------|
| AUTH_001 | Unauthorized | Access endpoint without login |
| AUTH_005 | CSRF Invalid | POST without CSRF token |
| CUST_001 | Customer Not Found | GET /api/admin/customers/invalid_id |
| CUST_002 | Already Exists | Register with existing phone |
| SUB_001 | No Subscription | Access subscription before creating |
| WAL_001 | Insufficient Balance | Deposit charge when wallet low |
| WAL_004 | Invalid Amount | Top-up with ₹5 |
| WAL_005 | Below Minimum | Charge delivery with max negative balance |
| DEL_001 | Delivery Not Found | Mark non-existent delivery |
| DEL_005 | Cutoff Exceeded | Pause tomorrow after 5 PM |
| DEL_006 | Invalid Start Date | Set start date in past |
| BOT_001 | Collection Exceeds | Collect more bottles than available |
| CAL_003 | Invalid Date | Pass malformed date string |
| CAL_004 | Past Date | Pause yesterday |
| SYS_001 | Database Error | Generic DB failures |
| SYS_004 | Rate Limit | Too many requests |

---

## Automated Testing

### Prerequisites
```bash
cd backend-express
npm install --save-dev jest supertest @types/jest @types/supertest
```

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## Load Testing

### Using Apache Bench
```bash
# Test wallet top-up endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 -H "Cookie: connect.sid=xxx" \
  -p topup.json -T application/json \
  http://localhost:3000/api/customer/wallet/topup
```

### Using k6
```bash
# Install k6: brew install k6
k6 run load-test.js

# Expect:
# - 95th percentile < 200ms
# - 0% error rate
# - Throughput > 100 req/s
```

---

## Monitoring Checklist

### Production Deployment
- [ ] Enable compression middleware (✅ Done)
- [ ] Configure CORS properly
- [ ] Set up error logging (Sentry/LogRocket)
- [ ] Monitor database query performance
- [ ] Set up uptime monitoring
- [ ] Configure rate limiting per environment
- [ ] Enable SSL/TLS
- [ ] Set secure session cookies
- [ ] Configure database connection pooling

### Database
- [ ] All indexes created (✅ Done)
- [ ] Query execution plans verified
- [ ] Connection pool configured (min: 2, max: 10)
- [ ] Enable query logging in staging
- [ ] Set up automated backups
- [ ] Configure read replicas for reporting

---

## Common Issues & Solutions

### 1. "Could not load customer details" Error
**Cause:** Customer status transition edge case
**Solution:** Check statusManager.ts logic, verify status calculation

### 2. Wallet Goes Below Minimum
**Cause:** Concurrent delivery charges
**Solution:** SELECT FOR UPDATE lock (✅ Fixed)

### 3. Duplicate Deliveries Created
**Cause:** Race condition in ensureTodayDeliveries
**Solution:** Unique constraint + skipDuplicates (✅ Fixed)

### 4. PAUSED Status Stuck
**Cause:** Old pause records not deleted
**Solution:** Query only checks today/tomorrow pauses (✅ Fixed)

### 5. Deposit Not Charged at 90 Deliveries
**Cause:** Race condition on deliveryCount
**Solution:** SELECT FOR UPDATE on Subscription (✅ Fixed)

---

## API Health Check

### Quick Health Test
```bash
# 1. Server running
curl http://localhost:3000/health

# 2. Database connected
curl http://localhost:3000/api/health/db

# 3. Authentication working
curl -X POST http://localhost:3000/auth/google

# 4. Rate limiting active
for i in {1..20}; do curl http://localhost:3000/api/customer/dashboard; done
# Expect: 429 Too Many Requests after limit
```

---

## Success Criteria

### All Tests Pass When:
✅ Customer can complete full onboarding flow
✅ Wallet operations (top-up, charges) work correctly
✅ Delivery marking updates all related entities
✅ Bottle deposits charge at correct intervals
✅ 5 PM cutoff enforced correctly (IST timezone)
✅ Status transitions happen automatically
✅ Error responses use standard format
✅ Performance optimizations reduce response time
✅ No N+1 query issues in delivery listing
✅ Race conditions handled with locks
✅ Negative balance limits enforced

---

## Next Steps

1. **Manual Testing**: Go through each test scenario above
2. **Automated Tests**: Write Jest integration tests
3. **Load Testing**: Verify performance under load
4. **Production Deploy**: Follow monitoring checklist
5. **User Acceptance**: Get customer feedback

---

**Testing Status:** Ready for comprehensive testing
**Production Ready:** ✅ Yes (after testing)
**Mobile Optimized:** ✅ Yes (compression enabled)
**Error Handling:** ✅ Standardized

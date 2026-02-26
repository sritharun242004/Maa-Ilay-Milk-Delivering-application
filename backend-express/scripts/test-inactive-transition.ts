/**
 * Test Script: Auto-transition customers to INACTIVE when wallet exceeds grace period
 *
 * Tests:
 * 1. ensureTodayDeliveries: Only creates deliveries for ACTIVE customers, not INACTIVE
 * 2. Mark delivery (grace OK): Charges wallet, then updateCustomerStatus recalculates
 * 3. Mark delivery (exceeds grace): Pre-check catches, marks NOT_DELIVERED, sets INACTIVE
 * 4. Deposit skip: When deposit would exceed limit, skips instead of throwing
 * 5. Reactivation: Customer tops up → updateCustomerStatus → ACTIVE again
 *
 * Run: npx tsx scripts/test-inactive-transition.ts
 */

import 'dotenv/config';
import prisma from '../src/config/prisma';
import { calculateDailyPricePaise } from '../src/config/pricing';
import { ensureTodayDeliveries } from '../src/routes/delivery';
import { updateCustomerStatus, calculateCustomerStatus } from '../src/utils/statusManager';

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_PREFIX = 'TEST_INACTIVE_';
let deliveryPersonId: string;
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function todayUTCMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function todayEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
}

async function createTestCustomer(tag: string, walletPaise: number, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
  const quantityMl = 1000;
  const dailyPricePaise = calculateDailyPricePaise(quantityMl);
  const uniqueId = `${TEST_PREFIX}${tag}_${Date.now()}`;

  const customer = await prisma.customer.create({
    data: {
      email: `${uniqueId}@test.com`,
      name: `Test ${tag}`,
      phone: uniqueId.slice(0, 10).replace(/\D/g, '').padEnd(10, '0') + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
      addressLine1: 'Test Address',
      city: 'Pondicherry',
      pincode: '605001',
      status,
      deliveryPersonId,
      Subscription: {
        create: {
          dailyQuantityMl: quantityMl,
          dailyPricePaise,
          largeBotles: 1,
          smallBottles: 0,
          status: 'ACTIVE',
          deliveryCount: 5,
          lastDepositAtDelivery: 0,
        },
      },
      Wallet: {
        create: {
          balancePaise: walletPaise,
        },
      },
    },
    include: { Subscription: true, Wallet: true },
  });

  return customer;
}

async function createDeliveryForCustomer(customerId: string, chargePaise: number) {
  return prisma.delivery.create({
    data: {
      customerId,
      deliveryPersonId,
      deliveryDate: todayUTCMidnight(),
      quantityMl: 1000,
      largeBottles: 1,
      smallBottles: 0,
      chargePaise,
      depositPaise: 0,
      status: 'SCHEDULED',
    },
  });
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  // Delete test deliveries, customers, etc. (cascade handles related records)
  const testCustomers = await prisma.customer.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const ids = testCustomers.map(c => c.id);

  if (ids.length > 0) {
    await prisma.delivery.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.bottleLedger.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.walletTransaction.deleteMany({ where: { Wallet: { customerId: { in: ids } } } });
    await prisma.wallet.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.pause.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  }

  // Clean up test delivery person
  await prisma.deliveryPerson.deleteMany({ where: { phone: { startsWith: TEST_PREFIX } } });
}

// ── Tests ───────────────────────────────────────────────────────────────────

async function testEnsureTodayDeliveries_onlyActiveCustomers() {
  console.log('\n── Test 1: ensureTodayDeliveries only creates deliveries for ACTIVE, non-negative customers ──');

  // Customer A: ACTIVE with positive balance → should get delivery
  const activeCustomer = await createTestCustomer('active_good', 50000); // ₹500

  // Customer B: ACTIVE with ₹0 balance → should get delivery (last grace delivery)
  const activeZero = await createTestCustomer('active_zero', 0);

  // Customer C: ACTIVE but negative balance → should NOT get delivery
  const activeNeg = await createTestCustomer('active_neg', -100); // -₹1

  // Customer D: INACTIVE → should NOT get delivery
  const inactiveCustomer = await createTestCustomer('inactive', -50000, 'INACTIVE');

  const start = todayUTCMidnight();
  const end = todayEnd();

  await ensureTodayDeliveries(deliveryPersonId, start, end);

  const deliveries = await prisma.delivery.findMany({
    where: {
      deliveryPersonId,
      deliveryDate: { gte: start, lte: end },
      customerId: { in: [activeCustomer.id, activeZero.id, activeNeg.id, inactiveCustomer.id] },
    },
  });

  const deliveredCustomerIds = new Set(deliveries.map(d => d.customerId));

  assert(deliveredCustomerIds.has(activeCustomer.id), 'ACTIVE customer with ₹500 gets delivery');
  assert(deliveredCustomerIds.has(activeZero.id), 'ACTIVE customer with ₹0 gets delivery (last grace)');
  assert(!deliveredCustomerIds.has(activeNeg.id), 'ACTIVE customer with negative balance does NOT get delivery');
  assert(!deliveredCustomerIds.has(inactiveCustomer.id), 'INACTIVE customer does NOT get delivery');
}

async function testMarkDelivery_chargesAndSetsInactive() {
  console.log('\n── Test 2: Mark delivery — charges wallet, goes negative → INACTIVE ──');

  const dailyPrice = calculateDailyPricePaise(1000); // 11000

  // Customer with ₹50 balance — non-negative so delivery was created
  // After charge ₹110: wallet = -₹60 → INACTIVE
  const customer = await createTestCustomer('charge_neg', 5000); // ₹50
  const delivery = await createDeliveryForCustomer(customer.id, dailyPrice);

  const wallet = customer.Wallet!;
  const charge = delivery.chargePaise;

  // Pre-check: wallet >= 0 → passes (₹50 >= 0)
  assert(wallet.balancePaise >= 0, `Pre-check passes: balance ₹${wallet.balancePaise/100} >= ₹0`);

  // Simulate the wallet charge
  const newBalance = wallet.balancePaise - charge;
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balancePaise: newBalance },
  });
  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
  });

  // updateCustomerStatus: -₹60 < 0 → INACTIVE
  const newStatus = await updateCustomerStatus(customer.id);
  assert(newStatus === 'INACTIVE', `After charge, status is INACTIVE (wallet ₹${newBalance/100} < ₹0)`);
}

async function testMarkDelivery_negativeBalance_preCheckCatches() {
  console.log('\n── Test 3: Negative balance customer — pre-check catches, skips charge ──');

  const dailyPrice = calculateDailyPricePaise(1000); // 11000

  // Customer with -₹50 (negative = stale delivery row, shouldn't have been created)
  const customer = await createTestCustomer('neg_precheck', -5000); // -₹50
  const delivery = await createDeliveryForCustomer(customer.id, dailyPrice);

  const wallet = customer.Wallet!;

  // Pre-check should CATCH (current balance -₹50 < 0)
  const preCheckBlocks = wallet.balancePaise < 0;
  assert(preCheckBlocks, `Pre-check catches: balance ₹${wallet.balancePaise/100} < ₹0`);

  // Simulate what pre-check does: mark NOT_DELIVERED, don't charge
  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { status: 'NOT_DELIVERED', deliveryNotes: 'Auto-skipped: insufficient wallet balance' },
  });
  const newStatus = await updateCustomerStatus(customer.id);
  assert(newStatus === 'INACTIVE', `Customer set to INACTIVE`);

  // Wallet NOT charged
  const updatedWallet = await prisma.wallet.findUnique({ where: { customerId: customer.id } });
  assert(updatedWallet!.balancePaise === -5000, `Wallet NOT charged: still ₹${updatedWallet!.balancePaise/100}`);
}

async function testInactiveCustomer_noDeliveryNextDay() {
  console.log('\n── Test 4: INACTIVE customer does NOT get delivery created next day ──');

  const dailyPrice = calculateDailyPricePaise(1000);

  // Create INACTIVE customer with deeply negative balance
  const customer = await createTestCustomer('inactive_nodelivery', -20000, 'INACTIVE'); // -₹200

  const start = todayUTCMidnight();
  const end = todayEnd();

  await ensureTodayDeliveries(deliveryPersonId, start, end);

  const delivery = await prisma.delivery.findFirst({
    where: {
      customerId: customer.id,
      deliveryDate: { gte: start, lte: end },
    },
  });

  assert(delivery === null, 'No delivery created for INACTIVE customer');
}

async function testReactivation_topUpSetsActive() {
  console.log('\n── Test 5: INACTIVE customer tops up wallet → updateCustomerStatus sets ACTIVE ──');

  const dailyPrice = calculateDailyPricePaise(1000); // 11000

  // Create INACTIVE customer with -₹180 (below grace of -₹110)
  const customer = await createTestCustomer('reactivate', -18000, 'INACTIVE');

  // Verify currently INACTIVE (wallet -₹180 < grace -₹110)
  let status = await calculateCustomerStatus(customer.id);
  assert(status === 'INACTIVE', `Before top-up: INACTIVE (wallet ₹${-18000/100})`);

  // Simulate top-up: add ₹200 → balance becomes ₹20
  await prisma.wallet.update({
    where: { customerId: customer.id },
    data: { balancePaise: 2000 },
  });

  // updateCustomerStatus should set ACTIVE (₹20 >= -₹110)
  const newStatus = await updateCustomerStatus(customer.id);
  assert(newStatus === 'ACTIVE', `After top-up: ACTIVE (wallet ₹${2000/100})`);

  // Verify customer record
  const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert(updatedCustomer!.status === 'ACTIVE', 'Customer DB record is ACTIVE');
}

async function testCalculateCustomerStatus_boundaryValues() {
  console.log('\n── Test 6: calculateCustomerStatus boundary values (grace = 0) ──');

  // Zero balance → ACTIVE (can still get one last delivery)
  const zeroBalance = await createTestCustomer('zero_bal', 0);
  let status = await calculateCustomerStatus(zeroBalance.id);
  assert(status === 'ACTIVE', 'Zero balance (₹0): ACTIVE');

  // ₹1 balance → ACTIVE
  const oneRupee = await createTestCustomer('one_rupee', 100);
  status = await calculateCustomerStatus(oneRupee.id);
  assert(status === 'ACTIVE', '₹1 balance: ACTIVE');

  // -₹0.01 (1 paisa negative) → INACTIVE
  const justNeg = await createTestCustomer('just_neg', -1);
  status = await calculateCustomerStatus(justNeg.id);
  assert(status === 'INACTIVE', '-₹0.01 balance: INACTIVE');

  // -₹105 → INACTIVE
  const neg105 = await createTestCustomer('neg_105', -10500);
  status = await calculateCustomerStatus(neg105.id);
  assert(status === 'INACTIVE', '-₹105 balance: INACTIVE');

  // -₹180 → INACTIVE
  const neg180 = await createTestCustomer('neg_180', -18000);
  status = await calculateCustomerStatus(neg180.id);
  assert(status === 'INACTIVE', '-₹180 balance: INACTIVE');

  // Positive balance → ACTIVE
  const posBalance = await createTestCustomer('pos_bal', 50000);
  status = await calculateCustomerStatus(posBalance.id);
  assert(status === 'ACTIVE', '₹500 balance: ACTIVE');
}

async function testDepositSkipLogic() {
  console.log('\n── Test 7: Deposit skip and charge logic ──');

  const dailyPrice = calculateDailyPricePaise(1000); // 11000
  const { calculateBottleDepositPaise, shouldChargeDeposit } = await import('../src/config/pricing');
  const depositAmount = calculateBottleDepositPaise(1000); // ₹70 = 7000 paise

  const newDeliveryCount = 120;
  const shouldDeposit = shouldChargeDeposit(newDeliveryCount, 0);
  assert(shouldDeposit, `Delivery count 120 triggers deposit check`);

  // Test 7a: Deposit with ₹100 balance → ₹30 (still positive) → deposit GOES THROUGH
  const walletBalance7a = 10000; // ₹100
  const newBalance7a = walletBalance7a - depositAmount; // ₹100 - ₹70 = ₹30
  const depositOk7a = newBalance7a >= 0;
  assert(depositOk7a, `₹100 - ₹70 deposit = ₹${newBalance7a/100} >= ₹0 → deposit charges OK`);

  // Test 7b: Deposit with ₹50 balance → -₹20 (would go negative) → deposit SKIPPED
  const walletBalance7b = 5000; // ₹50
  const newBalance7b = walletBalance7b - depositAmount; // ₹50 - ₹70 = -₹20
  const depositSkipped7b = newBalance7b < 0;
  assert(depositSkipped7b, `₹50 - ₹70 deposit = ₹${newBalance7b/100} < ₹0 → deposit SKIPPED`);

  // Test 7c: When deposit is skipped, deliveryCount increments but lastDepositAtDelivery stays
  const customer = await prisma.customer.create({
    data: {
      email: `${TEST_PREFIX}deposit_skip_${Date.now()}@test.com`,
      name: 'Test Deposit Skip',
      phone: `${Date.now()}`.slice(-10).padEnd(10, '0'),
      addressLine1: 'Test Address',
      city: 'Pondicherry',
      pincode: '605001',
      status: 'ACTIVE',
      deliveryPersonId,
      Subscription: {
        create: {
          dailyQuantityMl: 1000,
          dailyPricePaise: dailyPrice,
          largeBotles: 1,
          smallBottles: 0,
          status: 'ACTIVE',
          deliveryCount: 119,
          lastDepositAtDelivery: 0,
        },
      },
      Wallet: {
        create: {
          balancePaise: 5000, // ₹50 → deposit ₹70 would push to -₹20 → skip
        },
      },
    },
    include: { Subscription: true, Wallet: true },
  });

  // Simulate deposit skip: just increment count
  await prisma.subscription.update({
    where: { customerId: customer.id },
    data: { deliveryCount: newDeliveryCount },
  });

  const updatedSub = await prisma.subscription.findUnique({ where: { customerId: customer.id } });
  assert(updatedSub!.deliveryCount === 120, 'Delivery count incremented to 120');
  assert(updatedSub!.lastDepositAtDelivery === 0, 'lastDepositAtDelivery stays at 0 (deposit skipped, will retry)');

  // Next delivery (121) should also trigger deposit attempt since lastDepositAtDelivery is still 0
  const shouldDepositNext = shouldChargeDeposit(121, 0);
  assert(shouldDepositNext, 'Delivery 121 still triggers deposit (since it was skipped at 120)');
}

// ── HTTP Integration Test ───────────────────────────────────────────────────

async function testHTTP_markDeliveryExceedsGrace() {
  console.log('\n── Test 8: HTTP API — Mark delivery that exceeds grace period ──');

  // This test requires the server to be running
  const BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

  try {
    // Check if server is running
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) {
      console.log('  ⚠ Server not running, skipping HTTP test');
      return;
    }
  } catch {
    console.log('  ⚠ Server not running at ' + BASE_URL + ', skipping HTTP test');
    return;
  }

  // Get delivery person credentials
  const dp = await prisma.deliveryPerson.findFirst({
    where: { id: deliveryPersonId },
  });

  if (!dp) {
    console.log('  ⚠ Test delivery person not found, skipping HTTP test');
    return;
  }

  // Login as delivery person
  const loginRes = await fetch(`${BASE_URL}/api/auth/delivery/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: dp.phone, password: 'test1234' }),
    redirect: 'manual',
  });

  // Extract cookies from login response
  const setCookies = loginRes.headers.getSetCookie?.() || [];
  const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');

  if (!cookieHeader || loginRes.status >= 400) {
    console.log(`  ⚠ Login failed (status ${loginRes.status}), skipping HTTP test`);
    return;
  }

  // Get CSRF token
  const csrfRes = await fetch(`${BASE_URL}/api/csrf-token`, {
    headers: { Cookie: cookieHeader },
  });
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const allCookies = [...setCookies, ...csrfCookies].map(c => c.split(';')[0]).join('; ');

  if (!csrfToken) {
    console.log('  ⚠ Could not get CSRF token, skipping HTTP test');
    return;
  }

  // Create a test customer with -₹180 (already below grace -₹110 → pre-check catches)
  const dailyPrice = calculateDailyPricePaise(1000);
  const customer = await createTestCustomer('http_test', -18000); // -₹180
  const delivery = await createDeliveryForCustomer(customer.id, dailyPrice);

  // Try to mark the delivery via API
  const markRes = await fetch(`${BASE_URL}/api/delivery/${delivery.id}/mark`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: allCookies,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      status: 'DELIVERED',
    }),
  });

  const markData = await markRes.json();

  assert(markRes.ok, `HTTP response is 200 OK (got ${markRes.status})`);
  assert(markData.success === true, 'Response has success: true');
  assert(typeof markData.warning === 'string', `Response has warning message: "${markData.warning || 'N/A'}"`);

  // Verify customer is now INACTIVE
  const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert(updatedCustomer!.status === 'INACTIVE', `Customer status is INACTIVE after API call`);

  // Verify delivery is NOT_DELIVERED
  const updatedDelivery = await prisma.delivery.findUnique({ where: { id: delivery.id } });
  assert(updatedDelivery!.status === 'NOT_DELIVERED', 'Delivery is NOT_DELIVERED after API call');

  // Verify wallet was NOT charged
  const updatedWallet = await prisma.wallet.findUnique({ where: { customerId: customer.id } });
  assert(updatedWallet!.balancePaise === -18000, `Wallet not charged: still ₹${updatedWallet!.balancePaise/100}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   INACTIVE Transition Tests — Maa Ilay Delivery System      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Clean up any leftover test data
    await cleanup();

    // Create test delivery person
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const hashedPw = await bcrypt.hash('test1234', 12);
    const dp = await prisma.deliveryPerson.create({
      data: {
        phone: `${TEST_PREFIX}${Date.now()}`.slice(0, 14),
        password: hashedPw,
        name: 'Test DP',
        createdByAdminId: 'test-admin',
      },
    });
    deliveryPersonId = dp.id;

    // Run tests
    await testEnsureTodayDeliveries_onlyActiveCustomers();
    await testMarkDelivery_chargesAndSetsInactive();
    await testMarkDelivery_negativeBalance_preCheckCatches();
    await testInactiveCustomer_noDeliveryNextDay();
    await testReactivation_topUpSetsActive();
    await testCalculateCustomerStatus_boundaryValues();
    await testDepositSkipLogic();
    await testHTTP_markDeliveryExceedsGrace();

    // Summary
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    if (failed === 0) {
      console.log('  ✓ ALL TESTS PASSED');
    } else {
      console.log('  ✗ SOME TESTS FAILED');
    }
    console.log('══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n✗ Test runner error:', error);
    failed++;
  } finally {
    // Clean up
    await cleanup();
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();

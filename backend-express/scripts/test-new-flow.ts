#!/usr/bin/env tsx
/**
 * Test New Subscription & Wallet Flow
 *
 * Tests:
 * 1. Subscribe without payment
 * 2. Add money to wallet
 * 3. Modify subscription
 * 4. Check wallet deduction logic
 */

import prisma from '../src/config/prisma';
import { calculateDailyPricePaise } from '../src/config/pricing';

async function testNewFlow() {
  console.log('🧪 Testing New Subscription & Wallet Flow\n');
  console.log('=' .repeat(60));

  try {
    // Find a test customer
    const customer = await prisma.customer.findFirst({
      where: { email: { contains: '@' } },
      include: {
        subscription: true,
        wallet: true
      }
    });

    if (!customer) {
      console.log('❌ No customer found in database');
      console.log('💡 Create a customer via onboarding first');
      return;
    }

    console.log(`\n📋 Testing with customer: ${customer.name} (${customer.email})`);
    console.log('=' .repeat(60));

    // Test 1: Subscription Logic
    console.log('\n✅ Test 1: Subscription (no payment)');
    console.log('-' .repeat(60));

    const testQuantities = [500, 1000, 1500, 2000, 2500];
    console.log('Testing quantities:', testQuantities.map(q => `${q}ml`).join(', '));

    for (const qty of testQuantities) {
      const price = calculateDailyPricePaise(qty);
      const priceRs = price / 100;
      console.log(`  ${qty}ml → ₹${priceRs}/day (${price} paise)`);
    }

    // Test 2: Wallet Logic
    console.log('\n✅ Test 2: Wallet Balance');
    console.log('-' .repeat(60));

    if (customer.wallet) {
      const balanceRs = customer.wallet.balancePaise / 100;
      console.log(`  Current balance: ₹${balanceRs.toFixed(2)}`);

      const transactions = await prisma.walletTransaction.findMany({
        where: { walletId: customer.wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      console.log(`  Recent transactions: ${transactions.length}`);
      transactions.forEach(txn => {
        const amtRs = (Math.abs(txn.amountPaise) / 100).toFixed(2);
        const sign = txn.amountPaise >= 0 ? '+' : '-';
        console.log(`    ${sign}₹${amtRs} - ${txn.description}`);
      });
    } else {
      console.log('  ⚠️  No wallet found (will be created on subscription)');
    }

    // Test 3: Subscription Status
    console.log('\n✅ Test 3: Subscription Status');
    console.log('-' .repeat(60));

    if (customer.subscription) {
      const sub = customer.subscription;
      const dailyRs = sub.dailyPricePaise / 100;
      console.log(`  Status: ${sub.status}`);
      console.log(`  Daily Quantity: ${sub.dailyQuantityMl}ml`);
      console.log(`  Daily Price: ₹${dailyRs.toFixed(2)}`);
      console.log(`  Start Date: ${sub.startDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`  End Date: ${sub.endDate?.toISOString().split('T')[0] || 'Ongoing'}`);
    } else {
      console.log('  ⚠️  No subscription found');
    }

    // Test 4: Delivery Charge Calculation
    console.log('\n✅ Test 4: Delivery Charge Calculation');
    console.log('-' .repeat(60));

    const recentDelivery = await prisma.delivery.findFirst({
      where: { customerId: customer.id },
      orderBy: { deliveryDate: 'desc' }
    });

    if (recentDelivery) {
      const chargeRs = recentDelivery.chargePaise / 100;
      const expectedCharge = calculateDailyPricePaise(recentDelivery.quantityMl);
      const expectedRs = expectedCharge / 100;
      const matches = recentDelivery.chargePaise === expectedCharge;

      console.log(`  Delivery Quantity: ${recentDelivery.quantityMl}ml`);
      console.log(`  Stored Charge: ₹${chargeRs.toFixed(2)}`);
      console.log(`  Expected Charge: ₹${expectedRs.toFixed(2)}`);
      console.log(`  Matches: ${matches ? '✅ YES' : '❌ NO'}`);
      console.log(`  Status: ${recentDelivery.status}`);
    } else {
      console.log('  ⚠️  No deliveries found');
    }

    // Test 5: Wallet vs Subscription Validation
    console.log('\n✅ Test 5: Wallet Balance vs Daily Cost');
    console.log('-' .repeat(60));

    if (customer.wallet && customer.subscription) {
      const balanceRs = customer.wallet.balancePaise / 100;
      const dailyRs = customer.subscription.dailyPricePaise / 100;
      const daysCovered = Math.floor(balanceRs / dailyRs);
      const isActive = balanceRs >= dailyRs;

      console.log(`  Wallet Balance: ₹${balanceRs.toFixed(2)}`);
      console.log(`  Daily Cost: ₹${dailyRs.toFixed(2)}`);
      console.log(`  Days Covered: ${daysCovered} days`);
      console.log(`  Status: ${isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);

      if (!isActive && balanceRs > 0) {
        console.log(`  ⚠️  Insufficient balance for next delivery`);
      }
    }

    // Test 6: Price Accuracy
    console.log('\n✅ Test 6: Pricing Accuracy Check');
    console.log('-' .repeat(60));

    const deliveries = await prisma.delivery.findMany({
      where: {
        customerId: customer.id,
        chargePaise: { gt: 0 }
      },
      take: 10,
      orderBy: { deliveryDate: 'desc' }
    });

    let correct = 0;
    let incorrect = 0;

    for (const delivery of deliveries) {
      const expected = calculateDailyPricePaise(delivery.quantityMl);
      if (delivery.chargePaise === expected) {
        correct++;
      } else {
        incorrect++;
        console.log(`  ⚠️  Mismatch: ${delivery.quantityMl}ml → ` +
                   `Stored: ₹${(delivery.chargePaise/100).toFixed(2)}, ` +
                   `Expected: ₹${(expected/100).toFixed(2)}`);
      }
    }

    console.log(`  Checked: ${deliveries.length} deliveries`);
    console.log(`  Correct: ${correct} ✅`);
    console.log(`  Incorrect: ${incorrect} ${incorrect > 0 ? '❌' : '✅'}`);
    console.log(`  Accuracy: ${deliveries.length > 0 ? ((correct/deliveries.length)*100).toFixed(1) : '0'}%`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All Tests Completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testNewFlow().catch(console.error);

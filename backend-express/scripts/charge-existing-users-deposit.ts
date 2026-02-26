#!/usr/bin/env tsx
/**
 * Charge initial bottle deposit for existing active users
 * Run this once to migrate existing users to the new deposit system
 */

import prisma from '../src/config/prisma';
import { calculateBottleDepositPaise } from '../src/config/pricing';

async function chargeExistingUsersDeposit() {
  console.log('🔧 Charging bottle deposits for existing active users...\n');

  try {
    // Find all ACTIVE customers with subscriptions
    const allCustomers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
        subscription: {
          isNot: null
        }
      },
      include: {
        subscription: true,
        wallet: true
      }
    });

    // Filter for those who haven't been charged deposit yet
    const customers = allCustomers.filter(c =>
      c.subscription &&
      (c.subscription.lastDepositChargedAt === null || c.subscription.lastDepositAtDelivery === 0)
    );

    console.log(`Found ${customers.length} active customers to charge:\n`);

    let successCount = 0;
    let failedCount = 0;
    const failures: Array<{ name: string; reason: string }> = [];

    for (const customer of customers) {
      const sub = customer.subscription;
      const wallet = customer.wallet;

      if (!sub || !wallet) {
        console.log(`❌ ${customer.name}: No subscription or wallet found`);
        failedCount++;
        failures.push({ name: customer.name, reason: 'No subscription or wallet' });
        continue;
      }

      // Calculate deposit based on current subscription quantity
      const depositAmountPaise = calculateBottleDepositPaise(sub.dailyQuantityMl);
      const depositAmountRs = depositAmountPaise / 100;

      console.log(`Processing: ${customer.name}`);
      console.log(`  Subscription: ${sub.dailyQuantityMl}ml`);
      console.log(`  Deposit amount: ₹${depositAmountRs}`);
      console.log(`  Current wallet balance: ₹${wallet.balancePaise / 100}`);

      // Check if sufficient balance
      if (wallet.balancePaise < depositAmountPaise) {
        console.log(`  ❌ Insufficient balance (needs ₹${depositAmountRs}, has ₹${wallet.balancePaise / 100})\n`);
        failedCount++;
        failures.push({
          name: customer.name,
          reason: `Insufficient balance: needs ₹${depositAmountRs}, has ₹${wallet.balancePaise / 100}`
        });
        continue;
      }

      // Charge deposit in a transaction
      try {
        await prisma.$transaction(async (tx) => {
          const newBalance = wallet.balancePaise - depositAmountPaise;

          // Update wallet balance
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balancePaise: newBalance }
          });

          // Create transaction record
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'DEPOSIT_CHARGE',
              amountPaise: -depositAmountPaise,
              balanceAfterPaise: newBalance,
              description: `Initial bottle deposit for ${sub.dailyQuantityMl}ml subscription (migration)`,
              referenceType: 'deposit'
            }
          });

          // Update subscription deposit tracking
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              deliveryCount: 0, // Start fresh from 0
              lastDepositAtDelivery: 0,
              lastDepositChargedAt: new Date()
            }
          });
        });

        console.log(`  ✅ Charged ₹${depositAmountRs}, new balance: ₹${(wallet.balancePaise - depositAmountPaise) / 100}`);
        console.log(`  ✅ Reset delivery count to 0\n`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ Transaction failed: ${error}\n`);
        failedCount++;
        failures.push({ name: customer.name, reason: `Transaction failed: ${error}` });
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully charged: ${successCount} customers`);
    console.log(`❌ Failed: ${failedCount} customers\n`);

    if (failures.length > 0) {
      console.log('Failed customers:');
      failures.forEach(f => {
        console.log(`  - ${f.name}: ${f.reason}`);
      });
    }

    console.log('\n✅ Done! All existing active users have been charged initial bottle deposit.');
    console.log('📌 Delivery count has been reset to 0 for all users.');
    console.log('📌 Next deposit will be charged after 120 deliveries.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

chargeExistingUsersDeposit().catch(console.error);

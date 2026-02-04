#!/usr/bin/env tsx
/**
 * Fix users who have subscriptions but no delivery person assigned
 * Set their status back to PENDING_APPROVAL
 */

import prisma from '../src/config/prisma';

async function fixPendingUsers() {
  console.log('🔧 Fixing users without delivery person assignment...\n');

  try {
    // Find all customers with subscriptions but no delivery person
    const customers = await prisma.customer.findMany({
      where: {
        deliveryPersonId: null,
        subscription: {
          isNot: null
        }
      },
      include: {
        subscription: true
      }
    });

    console.log(`Found ${customers.length} customers without delivery person:\n`);

    for (const customer of customers) {
      console.log(`- ${customer.name} (${customer.email})`);
      console.log(`  Current status: ${customer.status}`);
      console.log(`  Subscription: ${customer.subscription?.dailyQuantityMl}ml/day`);

      if (customer.status !== 'PENDING_APPROVAL') {
        // Update status to PENDING_APPROVAL
        await prisma.customer.update({
          where: { id: customer.id },
          data: { status: 'PENDING_APPROVAL' }
        });
        console.log(`  ✅ Updated status to PENDING_APPROVAL\n`);
      } else {
        console.log(`  ✓ Already PENDING_APPROVAL\n`);
      }
    }

    console.log('✅ Done! All users without delivery persons are now PENDING_APPROVAL');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPendingUsers().catch(console.error);

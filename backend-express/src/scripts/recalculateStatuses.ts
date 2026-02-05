/**
 * Migration Script: Recalculate Customer Statuses
 *
 * This script updates all customer statuses based on the new business logic:
 * - VISITOR: No subscription
 * - PENDING_APPROVAL: Has subscription, no delivery person
 * - PAUSED: Has future pause dates
 * - INACTIVE: Has delivery person but insufficient balance
 * - ACTIVE: Has delivery person + sufficient balance
 *
 * Run this after deploying status calculation fixes
 */

import prisma from '../config/prisma';
import { calculateCustomerStatus, updateCustomerStatus } from '../utils/statusManager';

async function recalculateAllStatuses() {
  console.log('Starting status recalculation for all customers...\n');

  try {
    // Get all customers
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${customers.length} customers to process\n`);

    let updatedCount = 0;
    let unchangedCount = 0;
    const statusChanges: Array<{
      name: string;
      email: string;
      oldStatus: string;
      newStatus: string;
    }> = [];

    // Process each customer
    for (const customer of customers) {
      try {
        const oldStatus = customer.status;

        // Calculate new status
        const newStatus = await updateCustomerStatus(customer.id);

        if (oldStatus !== newStatus) {
          updatedCount++;
          statusChanges.push({
            name: customer.name,
            email: customer.email,
            oldStatus,
            newStatus,
          });
          console.log(`✓ ${customer.name}: ${oldStatus} → ${newStatus}`);
        } else {
          unchangedCount++;
        }
      } catch (error: any) {
        console.error(`✗ Error processing ${customer.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total customers: ${customers.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Unchanged: ${unchangedCount}`);
    console.log('='.repeat(60));

    if (statusChanges.length > 0) {
      console.log('\nDETAILED CHANGES:');
      console.log('='.repeat(60));

      // Group by status change type
      const grouped = statusChanges.reduce((acc, change) => {
        const key = `${change.oldStatus} → ${change.newStatus}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(change);
        return acc;
      }, {} as Record<string, typeof statusChanges>);

      for (const [changeType, changes] of Object.entries(grouped)) {
        console.log(`\n${changeType} (${changes.length} customers):`);
        changes.forEach(c => console.log(`  - ${c.name} (${c.email})`));
      }
    }

    console.log('\n✅ Status recalculation completed successfully!\n');

  } catch (error) {
    console.error('❌ Fatal error during status recalculation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recalculateAllStatuses()
  .then(() => {
    console.log('Script finished. You can now refresh the admin dashboard.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

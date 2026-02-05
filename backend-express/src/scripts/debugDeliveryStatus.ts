/**
 * Debug Script: Check Today's Delivery Status
 *
 * This script checks what delivery records exist for today
 * and shows their actual status to diagnose the "6 completed" issue
 */

import prisma from '../config/prisma';
import { toISTDateString, getDateRangeForDateColumn } from '../utils/dateUtils';

async function debugTodayDeliveries() {
  console.log('='.repeat(80));
  console.log('DEBUGGING TODAY\'S DELIVERY STATUS');
  console.log('='.repeat(80));
  console.log();

  try {
    // Get today's date range in IST
    const todayIST = toISTDateString(new Date());
    const todayRange = getDateRangeForDateColumn(todayIST);

    console.log(`Today (IST): ${todayIST}`);
    console.log(`Query Range: ${todayRange.start.toISOString()} to ${todayRange.end.toISOString()}`);
    console.log();

    // Get all delivery persons
    const deliveryPersons = await prisma.deliveryPerson.findMany({
      select: { id: true, name: true, phone: true }
    });

    console.log(`Found ${deliveryPersons.length} delivery persons\n`);

    for (const person of deliveryPersons) {
      console.log('-'.repeat(80));
      console.log(`📦 ${person.name} (${person.phone})`);
      console.log('-'.repeat(80));

      // Get all deliveries for this person today
      const deliveries = await prisma.delivery.findMany({
        where: {
          deliveryPersonId: person.id,
          deliveryDate: {
            gte: todayRange.start,
            lte: todayRange.end
          }
        },
        include: {
          Customer: {
            select: {
              name: true,
              phone: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (deliveries.length === 0) {
        console.log('  No deliveries assigned for today\n');
        continue;
      }

      // Count by status
      const statusCounts = deliveries.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`  Total Assigned: ${deliveries.length}`);
      console.log(`  Status Breakdown:`);
      for (const [status, count] of Object.entries(statusCounts)) {
        const emoji = status === 'DELIVERED' ? '✅' :
                     status === 'SCHEDULED' ? '⏰' :
                     status === 'NOT_DELIVERED' ? '❌' :
                     status === 'PAUSED' ? '⏸️' : '❓';
        console.log(`    ${emoji} ${status}: ${count}`);
      }
      console.log();

      // Show details of DELIVERED deliveries
      const delivered = deliveries.filter(d => d.status === 'DELIVERED');
      if (delivered.length > 0) {
        console.log(`  ✅ DELIVERED Deliveries (${delivered.length}):`);
        delivered.forEach((d, i) => {
          console.log(`    ${i + 1}. ${d.Customer.name} (${d.Customer.phone})`);
          console.log(`       Delivered at: ${d.deliveredAt?.toISOString() || 'NULL'}`);
          console.log(`       Quantity: ${d.quantityMl}ml`);
          console.log(`       Record created: ${d.createdAt.toISOString()}`);
        });
        console.log();
      }

      // Show details of SCHEDULED deliveries
      const scheduled = deliveries.filter(d => d.status === 'SCHEDULED');
      if (scheduled.length > 0) {
        console.log(`  ⏰ SCHEDULED Deliveries (${scheduled.length}):`);
        scheduled.forEach((d, i) => {
          console.log(`    ${i + 1}. ${d.Customer.name} (${d.Customer.phone})`);
          console.log(`       Quantity: ${d.quantityMl}ml`);
        });
        console.log();
      }
    }

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const allDeliveries = await prisma.delivery.findMany({
      where: {
        deliveryDate: {
          gte: todayRange.start,
          lte: todayRange.end
        }
      }
    });

    const totalByStatus = allDeliveries.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`Total Deliveries Today: ${allDeliveries.length}`);
    for (const [status, count] of Object.entries(totalByStatus)) {
      console.log(`  ${status}: ${count}`);
    }

    // Check if there are any deliveries marked as DELIVERED
    const deliveredCount = allDeliveries.filter(d => d.status === 'DELIVERED').length;
    if (deliveredCount > 0) {
      console.log();
      console.log('⚠️  WARNING: There are deliveries marked as DELIVERED!');
      console.log('   If no one has actually delivered yet, these need to be reset to SCHEDULED.');
    }

    console.log();
    console.log('✅ Debug complete!');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
debugTodayDeliveries()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

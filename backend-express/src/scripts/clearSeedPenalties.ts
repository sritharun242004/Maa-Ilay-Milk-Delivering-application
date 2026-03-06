import prisma from '../config/prisma';

async function clearSeedPenalties() {
  console.log('🧹 Clearing seed bottle ledger entries...');

  try {
    // Get customers with old bottle issues (seed data from before March 1st)
    const oldEntries = await prisma.bottleLedger.findMany({
      where: {
        createdAt: {
          lt: new Date('2026-03-01') // Before March 1st (seed data)
        },
        action: 'ISSUED'
      },
      include: {
        Customer: {
          select: { name: true, email: true }
        }
      }
    });

    console.log(`Found ${oldEntries.length} seed bottle ledger entries to clear`);

    if (oldEntries.length === 0) {
      console.log('✅ No seed penalty data to clear');
      return;
    }

    // Show what we're about to delete
    console.log('📋 Entries to be cleared:');
    oldEntries.forEach(entry => {
      console.log(`  - ${entry.Customer.name} (${entry.Customer.email}): ${entry.quantity}x ${entry.size} bottles issued on ${entry.createdAt.toISOString().split('T')[0]}`);
    });

    // Delete the old bottle ledger entries
    const result = await prisma.bottleLedger.deleteMany({
      where: {
        createdAt: {
          lt: new Date('2026-03-01')
        },
        action: 'ISSUED'
      }
    });

    console.log(`✅ Cleared ${result.count} seed bottle ledger entries`);
    console.log('📊 The penalty page should now show only real customer penalties');

  } catch (error) {
    console.error('❌ Error clearing seed penalties:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearSeedPenalties();
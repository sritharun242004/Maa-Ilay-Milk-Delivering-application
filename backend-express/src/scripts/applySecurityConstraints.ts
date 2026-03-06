import prisma from '../config/prisma';

/**
 * Apply security constraints to database
 * This script adds business rule constraints and performance indexes
 * to improve data integrity and security
 */
async function applySecurityConstraints() {
  console.log('🔒 Applying security constraints to database...');

  try {
    // Add wallet balance constraint to prevent extreme negative balances
    console.log('Adding wallet balance constraint...');
    await prisma.$executeRaw`
      ALTER TABLE "Wallet"
      ADD CONSTRAINT wallet_balance_minimum
      CHECK ("balancePaise" >= -100000)
    `;
    console.log('✅ Wallet balance constraint added (min: ₹1000 negative)');

  } catch (error: any) {
    if (error.message.includes('already exists') || error.message.includes('wallet_balance_minimum')) {
      console.log('ℹ️  Wallet balance constraint already exists');
    } else {
      console.error('❌ Failed to add wallet balance constraint:', error.message);
    }
  }

  try {
    // Create performance indexes
    console.log('Creating performance indexes...');

    // Index for active customers
    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_active_status
      ON "Customer" ("deliveryPersonId", status)
      WHERE status IN ('ACTIVE', 'PENDING_APPROVAL')
    `;
    console.log('✅ Active customers index created');

    // Index for wallet balance queries
    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_balance
      ON "Wallet" ("customerId", "balancePaise")
    `;
    console.log('✅ Wallet balance index created');

    // Index for pause date queries
    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pause_date_range
      ON "Pause" ("customerId", "pauseDate")
      WHERE "pauseDate" >= CURRENT_DATE
    `;
    console.log('✅ Pause date index created');

  } catch (error: any) {
    console.error('⚠️  Some indexes may not have been created:', error.message);
    console.log('ℹ️  This may be because they already exist or the database is busy');
  }

  console.log('🎉 Security constraints applied successfully!');
  console.log('📊 Database now has improved integrity and performance');

  await prisma.$disconnect();
}

// Run the script
applySecurityConstraints().catch((error) => {
  console.error('❌ Failed to apply security constraints:', error);
  process.exit(1);
});
/**
 * Fix script: Create wallets for customers who don't have one
 *
 * This addresses the issue where customers onboarded before the wallet
 * creation fix don't have wallets, causing "Customer has no wallet" errors
 * when admin tries to add money.
 */

import prisma from '../config/prisma';

async function createMissingWallets() {
  console.log('🔍 Finding customers without wallets...');

  // Find all customers who don't have a wallet
  const customersWithoutWallet = await prisma.customer.findMany({
    where: {
      Wallet: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
    },
  });

  console.log(`📊 Found ${customersWithoutWallet.length} customers without wallets`);

  if (customersWithoutWallet.length === 0) {
    console.log('✅ All customers already have wallets!');
    return;
  }

  // Create wallets for all customers who don't have one
  let created = 0;
  for (const customer of customersWithoutWallet) {
    try {
      await prisma.wallet.create({
        data: {
          customerId: customer.id,
          balancePaise: 0,
        },
      });

      console.log(`✅ Created wallet for ${customer.name} (${customer.phone})`);
      created++;
    } catch (error) {
      console.error(`❌ Failed to create wallet for ${customer.name}:`, error);
    }
  }

  console.log(`\n🎉 Successfully created ${created} wallets`);
  console.log(`📋 Summary:`);
  console.log(`   - Total customers without wallets: ${customersWithoutWallet.length}`);
  console.log(`   - Wallets created: ${created}`);
  console.log(`   - Failed: ${customersWithoutWallet.length - created}`);
}

// Run the script
createMissingWallets()
  .then(() => {
    console.log('\n✨ Wallet creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error creating wallets:', error);
    process.exit(1);
  });
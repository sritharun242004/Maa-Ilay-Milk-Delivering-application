import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function activateCustomer() {
  console.log('\n🔧 Activating Customer: Tharun Kumar L\n');
  console.log('='.repeat(80));

  const customerPhone = '0733968812';

  try {
    // Find customer
    const customer = await prisma.customer.findFirst({
      where: { phone: customerPhone }
    });

    if (!customer) {
      console.log('❌ Customer not found!');
      return;
    }

    console.log(`\n📋 Found Customer: ${customer.name}`);
    console.log(`   Current Status: ${customer.status}\n`);

    // 1. Activate customer
    console.log('Step 1: Activating customer...');
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
      }
    });
    console.log('   ✅ Customer activated!\n');

    // 2. Create wallet if doesn't exist
    console.log('Step 2: Creating wallet...');
    const existingWallet = await prisma.wallet.findUnique({
      where: { customerId: customer.id }
    });

    if (existingWallet) {
      console.log('   ℹ️  Wallet already exists');
    } else {
      await prisma.wallet.create({
        data: {
          customerId: customer.id,
          balancePaise: 50000, // ₹500 initial balance
        }
      });
      console.log('   ✅ Wallet created with ₹500 balance!\n');
    }

    // 3. Create subscription if doesn't exist
    console.log('Step 3: Creating subscription...');
    const existingSubscription = await prisma.subscription.findUnique({
      where: { customerId: customer.id }
    });

    if (existingSubscription) {
      console.log('   ℹ️  Subscription already exists');
    } else {
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          dailyQuantityMl: 1000, // 1L per day
          dailyPricePaise: 11000, // ₹110 per day
          largeBotles: 1,
          smallBottles: 0,
          status: 'ACTIVE',
          startDate: new Date(),
          currentCycleStart: new Date(),
          paymentCycleCount: 1,
        }
      });
      console.log('   ✅ Subscription created (1L per day)!\n');
    }

    console.log('='.repeat(80));
    console.log('\n✅ SUCCESS! Customer is now ready for deliveries.\n');
    console.log('📋 Customer Summary:');
    console.log(`   Name: ${customer.name}`);
    console.log(`   Status: ACTIVE`);
    console.log(`   Subscription: 1L per day (₹110)`);
    console.log(`   Wallet Balance: ₹500`);
    console.log(`   Delivery Person: Tharun\n`);
    console.log('🚚 The customer will now appear in "Today\'s Deliveries"!\n');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

activateCustomer();

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function debugMissingCustomer() {
  console.log('\n🔍 Debugging Missing Customer: Tharun Kumar L\n');
  console.log('='.repeat(80));

  // Find customer by name
  const customer = await prisma.customer.findFirst({
    where: {
      name: {
        contains: 'Tharun Kumar',
        mode: 'insensitive',
      }
    },
    include: {
      subscription: true,
      wallet: true,
      deliveryPerson: true,
      pauses: {
        where: {
          pauseDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          }
        }
      }
    }
  });

  if (!customer) {
    console.log('❌ Customer "Tharun Kumar L" not found in database!');
    return;
  }

  console.log('\n📋 Customer Details:\n');
  console.log(`   Name: ${customer.name}`);
  console.log(`   Phone: ${customer.phone}`);
  console.log(`   Email: ${customer.email}`);
  console.log(`   Status: ${customer.status}`);
  console.log('');

  console.log('👤 Delivery Person Assignment:');
  if (customer.deliveryPerson) {
    console.log(`   ✅ Assigned to: ${customer.deliveryPerson.name}`);
    console.log(`   Phone: ${customer.deliveryPerson.phone}`);
  } else {
    console.log(`   ❌ NOT ASSIGNED to any delivery person!`);
    console.log(`   → This is why the customer doesn't appear in today's deliveries`);
  }
  console.log('');

  console.log('📦 Subscription Details:');
  if (customer.subscription) {
    console.log(`   Status: ${customer.subscription.status}`);
    console.log(`   Daily Quantity: ${customer.subscription.dailyQuantityMl}ml`);
    console.log(`   Daily Price: ₹${customer.subscription.dailyPricePaise / 100}`);
    console.log(`   Start Date: ${customer.subscription.startDate?.toISOString().split('T')[0] || 'N/A'}`);
  } else {
    console.log(`   ❌ NO SUBSCRIPTION found!`);
  }
  console.log('');

  console.log('💰 Wallet Details:');
  if (customer.wallet) {
    const balance = customer.wallet.balancePaise;
    const balanceRs = balance / 100;
    const dailyCharge = customer.subscription?.dailyPricePaise || 0;
    const graceLimitPaise = -dailyCharge;
    const isAboveGraceLimit = balance >= graceLimitPaise;

    console.log(`   Balance: ₹${balanceRs.toFixed(2)} (${balance} paise)`);
    console.log(`   Daily Charge: ₹${(dailyCharge / 100).toFixed(2)}`);
    console.log(`   Grace Limit: ₹${(graceLimitPaise / 100).toFixed(2)}`);
    console.log(`   Above Grace Limit: ${isAboveGraceLimit ? '✅ YES' : '❌ NO'}`);

    if (!isAboveGraceLimit) {
      console.log(`   → Customer has insufficient balance and is blocked!`);
    }
  } else {
    console.log(`   ❌ NO WALLET found!`);
  }
  console.log('');

  console.log('⏸️  Pauses for Today:');
  if (customer.pauses && customer.pauses.length > 0) {
    console.log(`   ❌ Customer is PAUSED for today!`);
    customer.pauses.forEach((pause, index) => {
      console.log(`   ${index + 1}. Date: ${pause.pauseDate.toISOString().split('T')[0]}`);
    });
    console.log(`   → This is why the customer doesn't appear in today's deliveries`);
  } else {
    console.log(`   ✅ NOT paused for today`);
  }
  console.log('');

  // Check if delivery exists for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const todayDelivery = await prisma.delivery.findFirst({
    where: {
      customerId: customer.id,
      deliveryDate: {
        gte: today,
        lte: todayEnd,
      }
    },
    include: {
      deliveryPerson: true,
    }
  });

  console.log('📦 Today\'s Delivery Record:');
  if (todayDelivery) {
    console.log(`   ✅ Delivery exists for today`);
    console.log(`   Quantity: ${todayDelivery.quantityMl}ml`);
    console.log(`   Charge: ₹${(todayDelivery.chargePaise / 100).toFixed(2)}`);
    console.log(`   Status: ${todayDelivery.status}`);
    console.log(`   Assigned to: ${todayDelivery.deliveryPerson?.name || 'Unknown'}`);
  } else {
    console.log(`   ❌ NO delivery record for today`);
    console.log(`   → System didn't create delivery record`);
  }
  console.log('');

  console.log('='.repeat(80));
  console.log('\n🔎 ANALYSIS:\n');

  // Determine why customer is missing
  const reasons: string[] = [];

  if (customer.status !== 'ACTIVE') {
    reasons.push(`❌ Customer status is "${customer.status}" (must be ACTIVE)`);
  }

  if (!customer.deliveryPersonId) {
    reasons.push(`❌ Customer is not assigned to any delivery person`);
  }

  if (!customer.subscription || customer.subscription.status !== 'ACTIVE') {
    reasons.push(`❌ Subscription is not ACTIVE`);
  }

  if (customer.wallet) {
    const balance = customer.wallet.balancePaise;
    const dailyCharge = customer.subscription?.dailyPricePaise || 0;
    const graceLimitPaise = -dailyCharge;
    if (balance < graceLimitPaise) {
      reasons.push(`❌ Wallet balance (₹${(balance / 100).toFixed(2)}) is below grace limit (₹${(graceLimitPaise / 100).toFixed(2)})`);
    }
  } else {
    reasons.push(`❌ Customer has no wallet`);
  }

  if (customer.pauses && customer.pauses.length > 0) {
    reasons.push(`❌ Customer is paused for today`);
  }

  if (reasons.length === 0) {
    console.log('✅ Customer meets ALL criteria for today\'s delivery!');
    console.log('   But still not showing? Check:');
    console.log('   1. Delivery person ID match');
    console.log('   2. Frontend filtering logic');
    console.log('   3. ensureTodayDeliveries function execution');
  } else {
    console.log('Customer is NOT appearing because:\n');
    reasons.forEach((reason, index) => {
      console.log(`   ${index + 1}. ${reason}`);
    });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await prisma.$disconnect();
}

debugMissingCustomer().catch(console.error);

import { PrismaClient } from '@prisma/client';
import { calculateDailyPricePaise } from '../src/config/pricing';
import 'dotenv/config';

const prisma = new PrismaClient();

async function verifyDeliveryCharges() {
  console.log('\n🔍 Verifying Delivery Charges Calculation\n');
  console.log('='.repeat(80));

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  console.log(`\n📅 Checking deliveries for: ${today.toISOString().split('T')[0]}\n`);

  // Get all deliveries for today
  const deliveries = await prisma.delivery.findMany({
    where: {
      deliveryDate: {
        gte: today,
        lte: todayEnd,
      }
    },
    include: {
      customer: {
        select: {
          name: true,
          phone: true,
        }
      },
      deliveryPerson: {
        select: {
          name: true,
        }
      }
    },
    orderBy: {
      deliveryPerson: {
        name: 'asc'
      }
    }
  });

  if (deliveries.length === 0) {
    console.log('❌ No deliveries found for today.');
    console.log('   Run: npm run seed:today (to create test deliveries)');
    return;
  }

  console.log(`Found ${deliveries.length} deliveries for today:\n`);

  let correctCount = 0;
  let incorrectCount = 0;

  for (const delivery of deliveries) {
    const expectedCharge = calculateDailyPricePaise(delivery.quantityMl);
    const actualCharge = delivery.chargePaise;
    const isCorrect = expectedCharge === actualCharge;

    if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    const status = isCorrect ? '✅' : '❌';
    console.log(`${status} ${delivery.customer.name} (${delivery.customer.phone})`);
    console.log(`   Quantity: ${delivery.quantityMl}ml`);
    console.log(`   Bottles: ${delivery.largeBottles}L + ${delivery.smallBottles}×500ml`);
    console.log(`   Expected Charge: ₹${(expectedCharge / 100).toFixed(2)} (${expectedCharge} paise)`);
    console.log(`   Actual Charge: ₹${(actualCharge / 100).toFixed(2)} (${actualCharge} paise)`);
    console.log(`   Status: ${delivery.status}`);
    console.log(`   Delivery Person: ${delivery.deliveryPerson.name}`);

    if (!isCorrect) {
      console.log(`   ⚠️  MISMATCH! Difference: ₹${Math.abs((expectedCharge - actualCharge) / 100).toFixed(2)}`);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`   ✅ Correct charges: ${correctCount} deliveries`);
  console.log(`   ❌ Incorrect charges: ${incorrectCount} deliveries`);
  console.log(`   Total: ${deliveries.length} deliveries`);

  if (incorrectCount > 0) {
    console.log('\n⚠️  WARNING: Some deliveries have incorrect charges!');
    console.log('   This needs to be fixed to ensure accurate billing.');
  } else {
    console.log('\n✅ All deliveries have correct charges!');
    console.log('   The system is calculating charges properly based on quantity.');
  }

  // Check for modifications
  console.log('\n📝 Checking for delivery modifications...\n');
  const modifications = await prisma.deliveryModification.findMany({
    where: {
      date: {
        gte: today,
        lte: todayEnd,
      }
    },
    include: {
      customer: {
        select: {
          name: true,
          subscription: true,
        }
      }
    }
  });

  if (modifications.length === 0) {
    console.log('   No modifications found for today.');
  } else {
    console.log(`   Found ${modifications.length} modifications:\n`);
    for (const mod of modifications) {
      const baseQuantity = mod.customer.subscription?.dailyQuantityMl || 0;
      console.log(`   📌 ${mod.customer.name}:`);
      console.log(`      Base quantity: ${baseQuantity}ml`);
      console.log(`      Modified to: ${mod.quantityMl}ml`);
      console.log(`      Expected charge: ₹${(calculateDailyPricePaise(mod.quantityMl) / 100).toFixed(2)}`);
      console.log('');
    }
  }

  console.log('='.repeat(80));
  console.log('\n💡 How it works:');
  console.log('   1. System creates delivery records with correct chargePaise');
  console.log('   2. chargePaise is calculated from quantityMl using:');
  console.log('      - 500ml = ₹68');
  console.log('      - 1L = ₹110');
  console.log('      - 1.5L = ₹178 (1L + 500ml)');
  console.log('      - 2L = ₹220 (2 × 1L)');
  console.log('   3. When delivery is marked, that chargePaise is deducted from wallet');
  console.log('   4. If customer modified quantity for specific day, that charge applies\n');

  await prisma.$disconnect();
}

verifyDeliveryCharges().catch(console.error);

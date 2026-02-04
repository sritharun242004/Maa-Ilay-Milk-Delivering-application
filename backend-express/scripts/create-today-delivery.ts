import { PrismaClient } from '@prisma/client';
import { calculateDailyPricePaise } from '../src/config/pricing';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createTodayDelivery() {
  console.log('\n📦 Creating Today\'s Delivery for Tharun Kumar L\n');
  console.log('='.repeat(80));

  const customerPhone = '0733968812';

  try {
    // Find customer with all details
    const customer = await prisma.customer.findFirst({
      where: { phone: customerPhone },
      include: {
        subscription: true,
        deliveryPerson: true,
      }
    });

    if (!customer) {
      console.log('❌ Customer not found!');
      return;
    }

    if (!customer.subscription) {
      console.log('❌ Customer has no subscription!');
      return;
    }

    if (!customer.deliveryPersonId) {
      console.log('❌ Customer not assigned to delivery person!');
      return;
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`\n📋 Customer: ${customer.name}`);
    console.log(`   Delivery Person: ${customer.deliveryPerson?.name}`);
    console.log(`   Date: ${today.toISOString().split('T')[0]}\n`);

    // Check if delivery already exists
    const existingDelivery = await prisma.delivery.findFirst({
      where: {
        customerId: customer.id,
        deliveryDate: today,
      }
    });

    if (existingDelivery) {
      console.log('ℹ️  Delivery already exists for today!');
      console.log(`   Status: ${existingDelivery.status}`);
      console.log(`   Quantity: ${existingDelivery.quantityMl}ml`);
      console.log(`   Charge: ₹${(existingDelivery.chargePaise / 100).toFixed(2)}\n`);
      return;
    }

    // Check for modifications
    const modification = await prisma.deliveryModification.findFirst({
      where: {
        customerId: customer.id,
        date: today,
      }
    });

    // Calculate delivery details
    const quantityMl = modification?.quantityMl || customer.subscription.dailyQuantityMl;
    const largeBottles = modification?.largeBottles || customer.subscription.largeBotles || Math.floor(quantityMl / 1000);
    const smallBottles = modification?.smallBottles || customer.subscription.smallBottles || (quantityMl % 1000 >= 500 ? 1 : 0);
    const chargePaise = calculateDailyPricePaise(quantityMl);

    console.log('Creating delivery with:');
    console.log(`   Quantity: ${quantityMl}ml`);
    console.log(`   Bottles: ${largeBottles}L + ${smallBottles}×500ml`);
    console.log(`   Charge: ₹${(chargePaise / 100).toFixed(2)}\n`);

    // Create delivery
    const delivery = await prisma.delivery.create({
      data: {
        customerId: customer.id,
        deliveryPersonId: customer.deliveryPersonId,
        deliveryDate: today,
        quantityMl,
        largeBottles,
        smallBottles,
        chargePaise,
        depositPaise: 0,
        status: 'SCHEDULED',
        deliveryNotes: modification?.notes || null,
      }
    });

    console.log('✅ Delivery created successfully!\n');
    console.log('='.repeat(80));
    console.log('\n🎉 SUCCESS! The customer will now appear in "Today\'s Deliveries"!\n');
    console.log('📱 Refresh the delivery person app to see the update.\n');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTodayDelivery();

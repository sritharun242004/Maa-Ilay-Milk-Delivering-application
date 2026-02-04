import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function checkAndResetDeliveryPersons() {
  console.log('Checking delivery persons in database...\n');

  try {
    // Get all delivery persons
    const deliveryPersons = await prisma.deliveryPerson.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        _count: {
          select: { customers: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (deliveryPersons.length === 0) {
      console.log('❌ No delivery persons found in database!');
      console.log('\nYou need to run the seed script:');
      console.log('   npm run seed\n');
      return;
    }

    console.log(`Found ${deliveryPersons.length} delivery person(s):\n`);
    deliveryPersons.forEach((dp, index) => {
      console.log(`${index + 1}. ${dp.name}`);
      console.log(`   Phone: ${dp.phone}`);
      console.log(`   Active: ${dp.isActive ? 'Yes' : 'No'}`);
      console.log(`   Customers: ${dp._count.customers}`);
      console.log('');
    });

    // Reset passwords to known values
    console.log('Resetting passwords to default values...\n');

    const defaultPasswords = [
      { phone: '9876543211', name: 'Vijay', password: 'vijay123' },
      { phone: '9876543210', name: 'Rajesh Kumar', password: 'delivery123' },
      { phone: '0987654321', name: 'Tharun', password: 'delivery123' },
    ];

    for (const dp of defaultPasswords) {
      const person = await prisma.deliveryPerson.findUnique({
        where: { phone: dp.phone }
      });

      if (person) {
        const hashedPassword = await bcrypt.hash(dp.password, 12);
        await prisma.deliveryPerson.update({
          where: { phone: dp.phone },
          data: { password: hashedPassword }
        });
        console.log(`✓ Reset password for ${person.name} (${dp.phone})`);
      }
    }

    console.log('\n========================================');
    console.log('LOGIN CREDENTIALS (UPDATED)');
    console.log('========================================\n');

    console.log('🚚 DELIVERY PERSONS:\n');
    for (const dp of defaultPasswords) {
      const person = await prisma.deliveryPerson.findUnique({
        where: { phone: dp.phone }
      });
      if (person) {
        console.log(`   ${person.name}:`);
        console.log(`   Phone: ${dp.phone}`);
        console.log(`   Password: ${dp.password}`);
        console.log('');
      }
    }

    // Also show admin credentials
    const admin = await prisma.admin.findUnique({
      where: { email: 'admin@maailay.com' }
    });

    if (admin) {
      console.log('📋 ADMIN:');
      console.log('   Email: admin@maailay.com');
      console.log('   Password: admin123');
      console.log('   (If this doesn\'t work, run: npm run seed)\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndResetDeliveryPersons();

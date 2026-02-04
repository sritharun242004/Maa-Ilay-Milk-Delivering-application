import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function testDeliveryLogin() {
  console.log('Testing delivery person login credentials...\n');

  // Test credentials
  const testCases = [
    { phone: '9876543211', password: 'vijay123', name: 'Vijay' },
    { phone: '9876543210', password: 'delivery123', name: 'Rajesh Kumar' },
    { phone: '0987654321', password: 'delivery123', name: 'Tharun' },
  ];

  for (const test of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${test.name}`);
    console.log(`Phone: ${test.phone}`);
    console.log(`Password: ${test.password}`);
    console.log('='.repeat(60));

    try {
      // Find delivery person by phone
      const delivery = await prisma.deliveryPerson.findUnique({
        where: { phone: test.phone },
      });

      if (!delivery) {
        console.log('❌ RESULT: Phone number NOT FOUND in database');
        console.log('   This phone number does not exist.');
        continue;
      }

      console.log('✓ Found delivery person:');
      console.log(`   ID: ${delivery.id}`);
      console.log(`   Name: ${delivery.name}`);
      console.log(`   Phone: ${delivery.phone}`);
      console.log(`   Active: ${delivery.isActive}`);

      // Test password
      const isValid = await bcrypt.compare(test.password, delivery.password);

      if (isValid) {
        console.log(`\n✅ PASSWORD VALID - Login should work!`);
        console.log(`   Use these credentials:`);
        console.log(`   Phone: ${test.phone}`);
        console.log(`   Password: ${test.password}`);
      } else {
        console.log(`\n❌ PASSWORD INVALID - Login will fail`);
        console.log(`   The password in database doesn't match "${test.password}"`);
        console.log(`   Resetting password now...`);

        // Reset the password
        const newHash = await bcrypt.hash(test.password, 12);
        await prisma.deliveryPerson.update({
          where: { phone: test.phone },
          data: { password: newHash },
        });

        console.log(`   ✓ Password reset to: ${test.password}`);
        console.log(`   Try logging in again now.`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  console.log('\nRECOMMENDED CREDENTIALS TO USE:');
  console.log('\n🚚 For testing with customers:');
  console.log('   Phone: 9876543210');
  console.log('   Password: delivery123');
  console.log('   (Rajesh Kumar - has 6 customers)');
  console.log('\nOR');
  console.log('   Phone: 0987654321');
  console.log('   Password: delivery123');
  console.log('   (Tharun - has 9 customers)');
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
}

testDeliveryLogin();

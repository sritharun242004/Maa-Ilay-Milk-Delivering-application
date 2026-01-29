import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import ws from 'ws'

// Configure WebSocket for Node.js
neonConfig.webSocketConstructor = ws

// Create Prisma client with Neon adapter
const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

// Helper function to generate random password
function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

async function main() {
  console.log('Seeding database...')

  // Create initial admin
  const adminPassword = await bcrypt.hash('admin123', 12)
  
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@maailay.com' },
    update: {},
    create: {
      email: 'admin@maailay.com',
      password: adminPassword,
      name: 'Maa Ilay Admin',
      phone: '9876543210',
      isActive: true,
    },
  })

  console.log('✓ Admin created:')
  console.log('  Email: admin@maailay.com')
  console.log('  Password: admin123')

  // Create delivery person - Vijay
  const vijayPassword = generatePassword()
  const vijayPasswordHash = await bcrypt.hash(vijayPassword, 12)
  
  const vijay = await prisma.deliveryPerson.upsert({
    where: { phone: '9876543211' },
    update: {},
    create: {
      phone: '9876543211',
      password: vijayPasswordHash,
      name: 'Vijay',
      zone: 'Pondicherry Central',
      isActive: true,
      createdByAdminId: admin.id,
    },
  })

  console.log('✓ Delivery Person created:')
  console.log('  Name: Vijay')
  console.log('  Phone: 9876543211')
  console.log('  Password: ' + vijayPassword)
  console.log('  Zone: Pondicherry Central')

  // Create initial inventory
  await prisma.inventory.upsert({
    where: { id: 'default-inventory' },
    update: {},
    create: {
      id: 'default-inventory',
      largeBottlesTotal: 100,
      smallBottlesTotal: 50,
      largeBottlesInCirculation: 0,
      smallBottlesInCirculation: 0,
    },
  })

  console.log('✓ Inventory initialized (100 large, 50 small bottles)')

  // Create system config
  const configs = [
    { key: 'milk_price_per_liter_paise', value: '11000', description: 'Price per liter in paise (₹110)' },
    { key: 'deposit_large_bottle_paise', value: '3500', description: 'Deposit for 1L bottle (₹35)' },
    { key: 'deposit_small_bottle_paise', value: '2500', description: 'Deposit for 500ml bottle (₹25)' },
    { key: 'max_pause_days_per_month', value: '5', description: 'Maximum pause days per month' },
    { key: 'penalty_trigger_days', value: '7', description: 'Days after which penalty is applied' },
    { key: 'cutoff_hour', value: '17', description: 'Cutoff hour for next day changes (5 PM)' },
    { key: 'grace_period_days', value: '1', description: 'Days of negative balance allowed' },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    })
  }

  console.log('✓ System config initialized')

  console.log('\n========================================')
  console.log('SEEDING COMPLETE!')
  console.log('========================================')
  console.log('\nLogin Credentials:')
  console.log('\n📋 ADMIN:')
  console.log('   URL: http://localhost:3000/login/admin')
  console.log('   Email: admin@maailay.com')
  console.log('   Password: admin123')
  console.log('\n🚚 DELIVERY PERSON (Vijay):')
  console.log('   URL: http://localhost:3000/login/delivery')
  console.log('   Phone: 9876543211')
  console.log('   Password: ' + vijayPassword)
  console.log('\n========================================\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

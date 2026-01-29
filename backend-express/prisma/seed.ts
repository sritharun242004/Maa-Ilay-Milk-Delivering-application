import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()

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

  // Delivery person - Rajesh Kumar (Zone 1) for mock deliveries
  const rajeshPassword = await bcrypt.hash('delivery123', 12)
  const rajesh = await prisma.deliveryPerson.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      phone: '9876543210',
      password: rajeshPassword,
      name: 'Rajesh Kumar',
      zone: 'Zone 1',
      isActive: true,
      createdByAdminId: admin.id,
    },
  })
  console.log('✓ Delivery Person (Rajesh Kumar) created: Phone 9876543210, Password: delivery123, Zone 1')

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

  // ----- Mock data for delivery person testing -----
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  console.log('Seeding today\'s deliveries for:', today.toISOString().slice(0, 10))

  const mockCustomers = [
    { email: 'priya.sharma@example.com', name: 'Priya Sharma', phone: '9876511111', addressLine1: '42, Auroville Main Road', pincode: '605101', deliveryNotes: 'Leave at door if not home' },
    { email: 'amit.kumar@example.com', name: 'Amit Kumar', phone: '9876522222', addressLine1: '15, Solitude Farm Road', pincode: '605101' },
    { email: 'lakshmi.devi@example.com', name: 'Lakshmi Devi', phone: '9876533333', addressLine1: '28A, White Town', pincode: '605001' },
    { email: 'ravi.chandran@example.com', name: 'Ravi Chandran', phone: '9876544444', addressLine1: '7, Aspiration Community', pincode: '605102' },
    { email: 'sneha.pillai@example.com', name: 'Sneha Pillai', phone: '9876555555', addressLine1: '12, Beach Road', pincode: '605001' },
    { email: 'karthik.m@example.com', name: 'Karthik M', phone: '9876566666', addressLine1: '5, Mission Street', pincode: '605002' },
  ]

  for (let i = 0; i < mockCustomers.length; i++) {
    const c = mockCustomers[i]
    const customer = await prisma.customer.upsert({
      where: { email: c.email },
      update: { deliveryPersonId: rajesh.id },
      create: {
        email: c.email,
        name: c.name,
        phone: c.phone,
        addressLine1: c.addressLine1,
        pincode: c.pincode,
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedBy: admin.id,
        deliveryPersonId: rajesh.id,
        deliveryNotes: c.deliveryNotes ?? null,
      },
    })

    await prisma.subscription.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        dailyQuantityMl: i % 3 === 0 ? 2000 : 1000,
        dailyPricePaise: i % 3 === 0 ? 22000 : 11000,
        largeBotles: i % 3 === 0 ? 2 : 1,
        smallBottles: 0,
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentCycleStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        paymentCycleCount: 1,
      },
    })

    await prisma.wallet.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        balancePaise: 15000,
      },
    })

    // Today's delivery for this customer
    const quantityMl = i % 3 === 0 ? 2000 : 1000
    const largeBottles = i % 3 === 0 ? 2 : 1
    const chargePaise = i % 3 === 0 ? 22000 : 11000
    await prisma.delivery.upsert({
      where: {
        customerId_deliveryDate: { customerId: customer.id, deliveryDate: today },
      },
      update: {},
      create: {
        customerId: customer.id,
        deliveryPersonId: rajesh.id,
        deliveryDate: today,
        quantityMl,
        largeBottles,
        smallBottles: 0,
        chargePaise,
        depositPaise: 0,
        status: i < 2 ? 'SCHEDULED' : i < 4 ? 'DELIVERED' : 'SCHEDULED',
        deliveredAt: i >= 2 && i < 4 ? new Date() : null,
      },
    })

    // Past deliveries (last 7 days) for history
    for (let d = 1; d <= 7; d++) {
      const pastDate = new Date(today)
      pastDate.setDate(pastDate.getDate() - d)
      const isDelivered = d % 2 === 0
      await prisma.delivery.upsert({
        where: {
          customerId_deliveryDate: { customerId: customer.id, deliveryDate: pastDate },
        },
        update: {},
        create: {
          customerId: customer.id,
          deliveryPersonId: rajesh.id,
          deliveryDate: pastDate,
          quantityMl,
          largeBottles,
          smallBottles: 0,
          chargePaise,
          depositPaise: 0,
          status: isDelivered ? 'DELIVERED' : (d === 3 ? 'NOT_DELIVERED' : 'DELIVERED'),
          deliveredAt: isDelivered ? pastDate : null,
          deliveryNotes: d === 3 ? 'Customer not home' : null,
        },
      })
    }

    // Bottle ledger so "bottles with customer" shows
    await prisma.bottleLedger.create({
      data: {
        customerId: customer.id,
        action: 'ISSUED',
        size: 'LARGE',
        quantity: largeBottles,
        largeBottleBalanceAfter: largeBottles,
        smallBottleBalanceAfter: 0,
        description: 'Initial bottles',
      },
    })
  }

  console.log('✓ Mock delivery data: 6 customers, today + past deliveries, bottle ledger (Rajesh Kumar / Zone 1)')

  // ----- Mock data for delivery person Tharun (0987654321, Auroville) -----
  const tharunPassword = await bcrypt.hash('delivery123', 12)
  const tharun = await prisma.deliveryPerson.upsert({
    where: { phone: '0987654321' },
    update: {},
    create: {
      phone: '0987654321',
      password: tharunPassword,
      name: 'Tharun',
      zone: 'Auroville',
      isActive: true,
      createdByAdminId: admin.id,
    },
  })

  const tharunCustomers = [
    { email: 'tharun.anita@example.com', name: 'Anita Rao', phone: '9876577001', addressLine1: '12, Auroville Main Road', pincode: '605101', deliveryNotes: 'Ring twice' },
    { email: 'tharun.bala@example.com', name: 'Bala Krishnan', phone: '9876577002', addressLine1: '8, Solitude Farm Road', pincode: '605101' },
    { email: 'tharun.chitra@example.com', name: 'Chitra Venkat', phone: '9876577003', addressLine1: '22, Aspiration Community', pincode: '605102' },
    { email: 'tharun.dev@example.com', name: 'Dev Menon', phone: '9876577004', addressLine1: '5, Certitude Road', pincode: '605101', deliveryNotes: 'Leave at gate' },
    { email: 'tharun.ekta@example.com', name: 'Ekta Singh', phone: '9876577005', addressLine1: '18, Kottakarai', pincode: '605101' },
    { email: 'tharun.farooq@example.com', name: 'Farooq Ahmed', phone: '9876577006', addressLine1: '3, Bharat Nivas', pincode: '605101' },
  ]

  for (let i = 0; i < tharunCustomers.length; i++) {
    const c = tharunCustomers[i]
    const customer = await prisma.customer.upsert({
      where: { email: c.email },
      update: { deliveryPersonId: tharun.id },
      create: {
        email: c.email,
        name: c.name,
        phone: c.phone,
        addressLine1: c.addressLine1,
        pincode: c.pincode,
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedBy: admin.id,
        deliveryPersonId: tharun.id,
        deliveryNotes: c.deliveryNotes ?? null,
      },
    })

    await prisma.subscription.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        dailyQuantityMl: i % 3 === 0 ? 2000 : 1000,
        dailyPricePaise: i % 3 === 0 ? 22000 : 11000,
        largeBotles: i % 3 === 0 ? 2 : 1,
        smallBottles: 0,
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentCycleStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        paymentCycleCount: 1,
      },
    })

    await prisma.wallet.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        balancePaise: 15000,
      },
    })

    const quantityMl = i % 3 === 0 ? 2000 : 1000
    const largeBottles = i % 3 === 0 ? 2 : 1
    const chargePaise = i % 3 === 0 ? 22000 : 11000

    await prisma.delivery.upsert({
      where: {
        customerId_deliveryDate: { customerId: customer.id, deliveryDate: today },
      },
      update: {},
      create: {
        customerId: customer.id,
        deliveryPersonId: tharun.id,
        deliveryDate: today,
        quantityMl,
        largeBottles,
        smallBottles: 0,
        chargePaise,
        depositPaise: 0,
        status: i < 3 ? 'SCHEDULED' : i < 5 ? 'DELIVERED' : 'SCHEDULED',
        deliveredAt: i >= 3 && i < 5 ? new Date() : null,
      },
    })

    for (let d = 1; d <= 7; d++) {
      const pastDate = new Date(today)
      pastDate.setDate(pastDate.getDate() - d)
      const isDelivered = d % 2 === 0
      await prisma.delivery.upsert({
        where: {
          customerId_deliveryDate: { customerId: customer.id, deliveryDate: pastDate },
        },
        update: {},
        create: {
          customerId: customer.id,
          deliveryPersonId: tharun.id,
          deliveryDate: pastDate,
          quantityMl,
          largeBottles,
          smallBottles: 0,
          chargePaise,
          depositPaise: 0,
          status: isDelivered ? 'DELIVERED' : (d === 3 ? 'NOT_DELIVERED' : 'DELIVERED'),
          deliveredAt: isDelivered ? pastDate : null,
          deliveryNotes: d === 3 ? 'Customer not home' : null,
        },
      })
    }

    await prisma.bottleLedger.create({
      data: {
        customerId: customer.id,
        action: 'ISSUED',
        size: 'LARGE',
        quantity: largeBottles,
        largeBottleBalanceAfter: largeBottles,
        smallBottleBalanceAfter: 0,
        description: 'Initial bottles',
      },
    })
  }

  console.log('✓ Mock delivery data (Tharun): Phone 0987654321, Password: delivery123, Zone: Auroville – 6 customers, today + history')

  console.log('\n========================================')
  console.log('SEEDING COMPLETE!')
  console.log('========================================')
  console.log('\nLogin Credentials:')
  console.log('\n📋 ADMIN:')
  console.log('   Email: admin@maailay.com')
  console.log('   Password: admin123')
  console.log('\n🚚 DELIVERY PERSON (Vijay):')
  console.log('   Phone: 9876543211')
  console.log('   Password: ' + vijayPassword)
  console.log('\n🚚 DELIVERY PERSON (Rajesh Kumar – mock data):')
  console.log('   Phone: 9876543210')
  console.log('   Password: delivery123')
  console.log('   Zone 1 – 6 customers, today + history')
  console.log('\n🚚 DELIVERY PERSON (Tharun – mock data):')
  console.log('   Phone: 0987654321')
  console.log('   Password: delivery123')
  console.log('   Zone: Auroville – 6 customers, today + history')
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

/**
 * Seed ~1 year of mock data for tharxen24@gmail.com
 * Run: npx tsx prisma/seed-mock-customer.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const CUSTOMER_EMAIL = 'tharxen24@gmail.com';
const DELIVERY_PERSON_PHONE = '9876543211'; // or create Tarun
const DAILY_1L_PAISE = 11000;
const DEPOSIT_1L_PAISE = 7000;

function dateOnly(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

async function main() {
  console.log('Seeding mock data for', CUSTOMER_EMAIL, '...');

  const customer = await prisma.customer.findUnique({
    where: { email: CUSTOMER_EMAIL },
  });
  if (!customer) {
    console.error('Customer not found. Sign in with Google first as', CUSTOMER_EMAIL);
    process.exit(1);
  }

  let admin = await prisma.admin.findFirst();
  if (!admin) {
    admin = await prisma.admin.create({
      data: {
        email: 'admin@maailay.com',
        password: await bcrypt.hash('admin123', 12),
        name: 'Admin',
        isActive: true,
      },
    });
  }

  let deliveryPerson = await prisma.deliveryPerson.findUnique({
    where: { phone: DELIVERY_PERSON_PHONE },
  });
  if (!deliveryPerson) {
    deliveryPerson = await prisma.deliveryPerson.create({
      data: {
        phone: DELIVERY_PERSON_PHONE,
        password: await bcrypt.hash('vijay123', 12),
        name: 'Tarun',
        zone: 'Pondicherry Central',
        isActive: true,
        createdByAdminId: admin.id,
      },
    });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { deliveryPersonId: deliveryPerson.id, status: 'ACTIVE' },
  });

  let wallet = await prisma.wallet.findUnique({
    where: { customerId: customer.id },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { customerId: customer.id, balancePaise: 0 },
    });
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balancePaise: 0 },
  });

  let subscription = await prisma.subscription.findUnique({
    where: { customerId: customer.id },
  });
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        dailyQuantityMl: 1000,
        dailyPricePaise: DAILY_1L_PAISE,
        largeBotles: 2,
        smallBottles: 0,
        status: 'ACTIVE',
        startDate: dateOnly(2025, 2, 1),
        currentCycleStart: dateOnly(2026, 1, 1),
        paymentCycleCount: 12,
        pauseDaysUsedThisMonth: 2,
        pauseMonthYear: '2026-01',
      },
    });
  }

  const statuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'NOT_DELIVERED', 'PAUSED'] as const;

  for (let offset = -60; offset <= 14; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = dateOnly(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const chargePaise = DAILY_1L_PAISE;
    await prisma.delivery.upsert({
      where: {
        customerId_deliveryDate: { customerId: customer.id, deliveryDate: date },
      },
      create: {
        customerId: customer.id,
        deliveryPersonId: deliveryPerson.id,
        deliveryDate: date,
        quantityMl: 1000,
        largeBottles: 2,
        smallBottles: 0,
        chargePaise,
        depositPaise: 0,
        status,
        deliveredAt: status === 'DELIVERED' ? new Date(d.getTime() + 6 * 60 * 60 * 1000) : null,
      },
      update: {},
    });
  }

  const finalBalance = 125000;
  await prisma.walletTransaction.createMany({
    data: [
      {
        walletId: wallet.id,
        type: 'WALLET_TOPUP',
        amountPaise: 100000,
        balanceAfterPaise: 100000,
        description: 'Wallet top-up',
        referenceType: 'payment',
      },
      {
        walletId: wallet.id,
        type: 'WALLET_TOPUP',
        amountPaise: 25000,
        balanceAfterPaise: finalBalance,
        description: 'Wallet top-up',
        referenceType: 'payment',
      },
    ],
  });
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balancePaise: finalBalance } });

  await prisma.pause.createMany({
    data: [
      { customerId: customer.id, pauseDate: dateOnly(2026, 1, 10), createdByCustomer: true },
      { customerId: customer.id, pauseDate: dateOnly(2026, 1, 15), createdByCustomer: true },
    ],
    skipDuplicates: true,
  });

  await prisma.bottleLedger.createMany({
    data: [
      {
        customerId: customer.id,
        action: 'ISSUED',
        size: 'LARGE',
        quantity: 2,
        largeBottleBalanceAfter: 2,
        smallBottleBalanceAfter: 0,
        description: 'Initial bottles',
        issuedDate: dateOnly(2025, 2, 1),
        performedByDeliveryPersonId: deliveryPerson.id,
      },
      {
        customerId: customer.id,
        action: 'ISSUED',
        size: 'LARGE',
        quantity: 1,
        largeBottleBalanceAfter: 3,
        smallBottleBalanceAfter: 0,
        description: 'Extra bottle issued',
        issuedDate: dateOnly(2025, 3, 1),
        performedByDeliveryPersonId: deliveryPerson.id,
      },
      {
        customerId: customer.id,
        action: 'RETURNED',
        size: 'LARGE',
        quantity: 1,
        largeBottleBalanceAfter: 2,
        smallBottleBalanceAfter: 0,
        description: 'Bottle collected',
        performedByDeliveryPersonId: deliveryPerson.id,
      },
      {
        customerId: customer.id,
        action: 'RETURNED',
        size: 'LARGE',
        quantity: 1,
        largeBottleBalanceAfter: 1,
        smallBottleBalanceAfter: 0,
        description: 'Bottle collected',
        performedByDeliveryPersonId: deliveryPerson.id,
      },
    ],
  });

  console.log('✓ Mock data seeded for', CUSTOMER_EMAIL);
  console.log('  Wallet balance:', finalBalance / 100, 'Rs');
  console.log('  Deliveries: ~2 months past + 2 weeks ahead');
  console.log('  Pause days in Jan 2026: 2');
  console.log('  Bottle ledger: 2 entries');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

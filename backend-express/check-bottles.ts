import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== COMPREHENSIVE BOTTLE ANALYSIS ===\n');

  const now = new Date();
  console.log('Current date:', now.toLocaleDateString('en-IN'));
  console.log('Current time:', now.toLocaleTimeString('en-IN'));
  console.log('');

  const allIssued = await prisma.bottleLedger.findMany({
    where: { action: 'ISSUED' },
    include: {
      Customer: {
        select: { name: true, phone: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total ISSUED bottles: ${allIssued.length}\n`);

  const overdueBottles: any[] = [];

  console.log('=== ALL ISSUED BOTTLES ===\n');

  for (const bottle of allIssued) {
    const issueDate = bottle.issuedDate || bottle.createdAt;
    const daysSince = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysSince > 3;
    const hasPenalty = bottle.penaltyAppliedAt !== null;

    const status = isOverdue && !hasPenalty ? '[⚠️ OVERDUE]' :
                   hasPenalty ? '[PENALTY APPLIED]' : '[OK]';

    console.log(`${status} ${bottle.Customer.name}`);
    console.log(`  ${bottle.quantity}x ${bottle.size} bottles`);
    console.log(`  Issued: ${issueDate.toLocaleDateString('en-IN')} (${daysSince} days ago)`);
    console.log(`  Penalty: ${hasPenalty ? 'Applied' : 'Not applied'}`);
    console.log('');

    if (isOverdue && !hasPenalty) {
      overdueBottles.push({
        customer: bottle.Customer.name,
        qty: bottle.quantity,
        size: bottle.size,
        days: daysSince,
        date: issueDate
      });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total issued bottles: ${allIssued.length}`);
  console.log(`Overdue (>3 days, no penalty): ${overdueBottles.length}`);

  if (overdueBottles.length > 0) {
    console.log('\n⚠️ CUSTOMERS WITH OVERDUE BOTTLES:');
    overdueBottles.forEach(b => {
      console.log(`  - ${b.customer}: ${b.qty}x ${b.size} (${b.days} days overdue)`);
    });
  }

  await prisma.$disconnect();
}

check().catch(console.error);

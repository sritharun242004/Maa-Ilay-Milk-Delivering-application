/**
 * Migration script to fix wallets with unrecorded initial balances
 *
 * Problem: Seed data creates wallets with initial balance but no transaction record
 * Solution: Create "Initial balance" transaction for wallets that have balance but no transactions
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking for wallets with unrecorded initial balances...\n')

  // Find all wallets
  const wallets = await prisma.wallet.findMany({
    include: {
      WalletTransaction: {
        orderBy: { createdAt: 'asc' },
        take: 1
      },
      Customer: {
        select: { name: true, email: true }
      }
    }
  })

  let fixedCount = 0
  let skippedCount = 0

  for (const wallet of wallets) {
    const firstTransaction = wallet.WalletTransaction[0]

    // If wallet has balance but no transactions, or first transaction doesn't match the current balance
    if (wallet.balancePaise > 0 && !firstTransaction) {
      console.log(`❌ Found wallet with unrecorded balance:`)
      console.log(`   Customer: ${wallet.Customer.name} (${wallet.Customer.email})`)
      console.log(`   Balance: ₹${(wallet.balancePaise / 100).toFixed(2)}`)
      console.log(`   Transactions: None`)

      // Create initial balance transaction
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WALLET_TOPUP',
          amountPaise: wallet.balancePaise,
          balanceAfterPaise: wallet.balancePaise,
          description: 'Initial balance (from seed/migration)',
          referenceType: 'migration',
          referenceId: `MIGRATION_${wallet.id}_${Date.now()}`,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Backdate by 30 days
        }
      })

      console.log(`   ✅ Created initial balance transaction\n`)
      fixedCount++
    } else if (firstTransaction && firstTransaction.balanceAfterPaise !== wallet.balancePaise) {
      // Wallet has transactions but the math doesn't add up
      const allTransactions = await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'asc' }
      })

      // Recalculate what the balance should be based on transactions
      let calculatedBalance = 0
      for (const txn of allTransactions) {
        calculatedBalance = txn.balanceAfterPaise
      }

      if (calculatedBalance !== wallet.balancePaise) {
        console.log(`⚠️  Balance mismatch detected:`)
        console.log(`   Customer: ${wallet.Customer.name} (${wallet.Customer.email})`)
        console.log(`   Wallet balance: ₹${(wallet.balancePaise / 100).toFixed(2)}`)
        console.log(`   Calculated from transactions: ₹${(calculatedBalance / 100).toFixed(2)}`)
        console.log(`   Difference: ₹${((wallet.balancePaise - calculatedBalance) / 100).toFixed(2)}`)

        // Create adjustment transaction for the difference
        const difference = wallet.balancePaise - calculatedBalance
        if (Math.abs(difference) > 0) {
          await prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: difference > 0 ? 'WALLET_TOPUP' : 'MILK_CHARGE',
              amountPaise: difference,
              balanceAfterPaise: wallet.balancePaise,
              description: `Balance adjustment (migration correction)`,
              referenceType: 'migration',
              referenceId: `ADJUSTMENT_${wallet.id}_${Date.now()}`,
              createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) // Backdate by 29 days
            }
          })
          console.log(`   ✅ Created adjustment transaction\n`)
          fixedCount++
        }
      } else {
        skippedCount++
      }
    } else {
      skippedCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   ✅ Fixed: ${fixedCount} wallets`)
  console.log(`   ⏭️  Skipped (no issues): ${skippedCount} wallets`)
  console.log(`   📝 Total checked: ${wallets.length} wallets\n`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

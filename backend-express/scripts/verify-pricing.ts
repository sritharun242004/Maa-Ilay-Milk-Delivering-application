#!/usr/bin/env tsx
/**
 * Verify New Pricing Structure
 *
 * Tests that all pricing calculations match the new pricing table:
 * - 500ml: ₹68/day
 * - 1L: ₹110/day
 * - 1.5L: ₹165/day
 * - 2L: ₹215/day
 * - 2.5L: ₹268/day
 */

import { calculateDailyPricePaise, calculateDailyPriceRs, ALLOWED_DAILY_QUANTITIES_ML } from '../src/config/pricing';

const EXPECTED_PRICING = {
  500: { paise: 6800, rs: 68 },
  1000: { paise: 11000, rs: 110 },
  1500: { paise: 16500, rs: 165 },
  2000: { paise: 21500, rs: 215 },
  2500: { paise: 26800, rs: 268 },
};

console.log('🧪 Verifying New Pricing Structure...\n');
console.log('═'.repeat(60));
console.log('Quantity    Expected       Calculated     Status');
console.log('═'.repeat(60));

let allPassed = true;

for (const quantityMl of ALLOWED_DAILY_QUANTITIES_ML) {
  const expected = EXPECTED_PRICING[quantityMl];
  const calculatedPaise = calculateDailyPricePaise(quantityMl);
  const calculatedRs = calculateDailyPriceRs(quantityMl);

  const paiseMatch = calculatedPaise === expected.paise;
  const rsMatch = calculatedRs === expected.rs;
  const passed = paiseMatch && rsMatch;

  const quantityLabel = quantityMl >= 1000 ? `${quantityMl / 1000}L` : `${quantityMl}ml`;
  const status = passed ? '✅ PASS' : '❌ FAIL';

  console.log(
    `${quantityLabel.padEnd(11)} ₹${expected.rs.toString().padEnd(13)} ₹${calculatedRs.toString().padEnd(13)} ${status}`
  );

  if (!passed) {
    console.log(`  ⚠️  Expected: ${expected.paise} paise, Got: ${calculatedPaise} paise`);
    console.log(`  ⚠️  Expected: ₹${expected.rs}, Got: ₹${calculatedRs}`);
    allPassed = false;
  }
}

console.log('═'.repeat(60));

// Test that removed quantities are not in allowed list
console.log('\n🔍 Verifying Removed Quantities...\n');
const removedQuantities = [3000, 3500, 4000];
for (const qty of removedQuantities) {
  const isAllowed = ALLOWED_DAILY_QUANTITIES_ML.includes(qty as any);
  const status = !isAllowed ? '✅ REMOVED' : '❌ STILL PRESENT';
  const qtyLabel = `${qty / 1000}L`;
  console.log(`${qtyLabel.padEnd(6)} ${status}`);
  if (isAllowed) allPassed = false;
}

// Test volume discounts
console.log('\n💰 Volume Discounts:\n');
console.log('Quantity    Old Price    New Price    Savings');
console.log('─'.repeat(50));
const discounts = [
  { qty: 1500, old: 178, new: 165, label: '1.5L' },
  { qty: 2000, old: 220, new: 215, label: '2L' },
  { qty: 2500, old: 288, new: 268, label: '2.5L' },
];

for (const { qty, old, label } of discounts) {
  const newPrice = calculateDailyPriceRs(qty);
  const savings = old - newPrice;
  const percent = ((savings / old) * 100).toFixed(0);
  console.log(`${label.padEnd(11)} ₹${old.toString().padEnd(11)} ₹${newPrice.toString().padEnd(11)} ₹${savings}/day (${percent}%)`);
}

console.log('\n' + '═'.repeat(60));
if (allPassed) {
  console.log('✅ All pricing calculations are correct!');
  console.log('✅ All removed quantities verified!');
  process.exit(0);
} else {
  console.log('❌ Some pricing calculations failed!');
  process.exit(1);
}

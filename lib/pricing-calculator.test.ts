// Test file to verify pricing calculations
// Example: Buy 3kg rice at ₹200/kg, sell 50g at ₹15

import { calculatePricingMetrics } from './pricing-calculator';
import { convertUnits } from './unit-converter';

console.log('[v0] ===== PRICING CALCULATION TEST =====');

// Test Case 1: Rice 50g @ ₹15 (from 3kg @ ₹200)
console.log('\n[v0] TEST 1: Rice 50g @ ₹15');
console.log('[v0] Input: costPerKg=₹200, qty=50g, sellingPrice=₹15');

const metrics1 = calculatePricingMetrics(200, 'kg', 50, 'g', 15);
console.log('[v0] Output:', {
  cost: '₹' + metrics1.cost,
  profit: '₹' + metrics1.profit,
  margin: metrics1.margin + '%',
  markup: metrics1.markup + '%'
});
console.log('[v0] Expected: Cost=₹10, Profit=₹5, Margin=33.33%, Markup=50%');

// Verify step by step
const tierQtyInKg = convertUnits(50, 'g', 'kg');
console.log('[v0] Step 1 - Convert 50g to kg:', tierQtyInKg, 'kg');
const cost = 200 * tierQtyInKg;
console.log('[v0] Step 2 - Cost: 200 × ' + tierQtyInKg + ' =', cost);
const profit = 15 - cost;
console.log('[v0] Step 3 - Profit: 15 - ' + cost + ' =', profit);
const margin = (profit / 15) * 100;
console.log('[v0] Step 4 - Margin: (' + profit + ' / 15) × 100 =', margin + '%');
const markup = (profit / cost) * 100;
console.log('[v0] Step 5 - Markup: (' + profit + ' / ' + cost + ') × 100 =', markup + '%');

// Test Case 2: Rice 250g @ ₹70
console.log('\n[v0] TEST 2: Rice 250g @ ₹70');
const metrics2 = calculatePricingMetrics(200, 'kg', 250, 'g', 70);
console.log('[v0] Output:', {
  cost: '₹' + metrics2.cost,
  profit: '₹' + metrics2.profit,
  margin: metrics2.margin + '%',
  markup: metrics2.markup + '%'
});
console.log('[v0] Expected: Cost=₹50, Profit=₹20, Margin=28.57%, Markup=40%');

// Test Case 3: Oil 500ml @ ₹150 (from 2L @ ₹600)
console.log('\n[v0] TEST 3: Oil 500ml @ ₹150 (from 2L @ ₹300/L)');
const metrics3 = calculatePricingMetrics(300, 'l', 500, 'ml', 150);
console.log('[v0] Output:', {
  cost: '₹' + metrics3.cost,
  profit: '₹' + metrics3.profit,
  margin: metrics3.margin + '%',
  markup: metrics3.markup + '%'
});
console.log('[v0] Expected: Cost=₹150, Profit=₹0, Margin=0%, Markup=0% (break-even)');

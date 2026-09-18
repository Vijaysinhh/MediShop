const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name) {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib', `${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (id) => id.startsWith('./') ? load(id.slice(2)) : require(id), module, module.exports,
  );
  return module.exports;
}

const { editableSaleQuantity, hasInvalidSalePrice, hasInvalidSaleQuantity, isSaleQuantityApplied, maxSaleQuantity, maxBillLineQuantity, resizeSaleLine, stepSaleQuantity } = load('sale-quantity');
const { getSalePaymentBreakdown, getStoredCreditAmount } = load('sale-payment');
const rice = { itemId: 1, quantity: 1, unitShortForm: 'KG', pricePerUnit: 50, costPerUnit: 40, displayQuantity: '1 KG', totalPrice: 50, totalCost: 40 };
const pack = { ...rice, quantity: 0.2, priceTierId: 7, packCount: 1, priceTierQuantity: 200, priceTierUnitShortForm: 'g', displayQuantity: '1 x 200 g', totalPrice: 10, totalCost: 8 };

test('partial payment records only the unpaid amount as Udhar', () => {
  assert.deepEqual(getSalePaymentBreakdown(100, 'partial', 40, 'cash'), {
    paidAmount: 40, dueAmount: 60, paidVia: 'cash', isValid: true,
  });
  assert.equal(getSalePaymentBreakdown(100, 'partial', 0, 'cash').isValid, false);
  assert.equal(getSalePaymentBreakdown(100, 'partial', 100, 'card').isValid, false);
  assert.equal(getSalePaymentBreakdown(100, 'partial', 110, 'cash').isValid, false);
});

test('cash, online and Udhar produce unambiguous payment splits', () => {
  assert.deepEqual(getSalePaymentBreakdown(100, 'cash'), {
    paidAmount: 100, dueAmount: 0, paidVia: 'cash', isValid: true,
  });
  assert.deepEqual(getSalePaymentBreakdown(100, 'card'), {
    paidAmount: 100, dueAmount: 0, paidVia: 'card', isValid: true,
  });
  assert.deepEqual(getSalePaymentBreakdown(100, 'udhar'), {
    paidAmount: 0, dueAmount: 100, paidVia: null, isValid: true,
  });
  assert.equal(getStoredCreditAmount({ payment_method: 'partial', subtotal: 100, due_amount: 60 }), 60);
  assert.equal(getStoredCreditAmount({ payment_method: 'udhari', subtotal: 100, due_amount: 0 }), 100);
});

test('stepper increases, decreases, caps at stock and never goes negative', () => {
  assert.equal(stepSaleQuantity(1, 1, 2), 2);
  assert.equal(stepSaleQuantity(2, 1, 2), 2);
  assert.equal(stepSaleQuantity(1.5, 1, 2), 2);
  assert.equal(stepSaleQuantity(0.5, -1, 2), 0);
  assert.equal(stepSaleQuantity(NaN, 1, 0.5), 0.5);
});
test('zero, negative and invalid quantities can never be submitted as a sale', () => {
  assert.equal(hasInvalidSaleQuantity([{quantity: 1}, {quantity: 0.5}]), false);
  assert.equal(hasInvalidSaleQuantity([{quantity: 0}]), true);
  assert.equal(hasInvalidSaleQuantity([{quantity: -1}]), true);
  assert.equal(hasInvalidSaleQuantity([{quantity: NaN}]), true);
  assert.equal(hasInvalidSaleQuantity([{quantity: 1, packCount: 0}]), true);
});
test('zero, negative and invalid selling prices can never be submitted as a sale', () => {
  assert.equal(hasInvalidSalePrice([{pricePerUnit: 10}, {pricePerUnit: 0.5}]), false);
  assert.equal(hasInvalidSalePrice([{pricePerUnit: 0}]), true);
  assert.equal(hasInvalidSalePrice([{pricePerUnit: -1}]), true);
  assert.equal(hasInvalidSalePrice([{pricePerUnit: NaN}]), true);
});
test('Sell search stays open for multi-product selection', () => {
  const component = fs.readFileSync(path.resolve(__dirname, '../components/sales-item-search.tsx'), 'utf8');
  assert.match(component, /searchOpen\s*&&\s*searchTerm\s*&&\s*\(/);
  assert.match(component, /handleQuickAdd\(item\)/);
  assert.match(component, /handleSearchChange\(event\.target\.value\)/);
  assert.match(component, /setSearchOpen\(false\)/);
  assert.match(component, /selected/);
  assert.match(component, /alreadyAdded/);
  const quickAdd = component.slice(component.indexOf('const handleQuickAdd'), component.indexOf('const finishSearch'));
  assert.doesNotMatch(quickAdd, /focusSearch\(\)/);
  assert.doesNotMatch(component, /setSearchTerm\(""\);\s*focusSearch\(\);\s*\n\s*};\s*\n\s*const handleItemSelect/);
});
test('remaining stock includes other lines but excludes the edited line once', () => {
  assert.equal(maxBillLineQuantity(2, [rice], 0), 2);
  assert.equal(maxBillLineQuantity(3, [rice, rice, { ...rice, itemId: 2 }], 0), 2);
  assert.equal(maxBillLineQuantity(0, [rice], 0), 0);
});
test('pack maximum is converted from remaining base-unit stock', () => {
  assert.equal(editableSaleQuantity(pack), 1);
  assert.equal(maxBillLineQuantity(2, [pack, rice], 0), 5);
  assert.equal(maxSaleQuantity(0.3, 0.1, 0.1), 2);
});
test('decimal edits update price, cost, and display without changing the original', () => {
  const updated = resizeSaleLine(rice, 0.5, 2);
  assert.equal(updated.quantity, 0.5);
  assert.equal(updated.totalPrice, 25);
  assert.equal(updated.totalCost, 20);
  assert.equal(updated.displayQuantity, '0.5 KG');
  assert.equal(rice.quantity, 1);
});
test('pack edits preserve pack pricing and stored metadata', () => {
  const updated = resizeSaleLine(pack, 3, 5);
  assert.equal(updated.quantity, 0.6);
  assert.equal(updated.packCount, 3);
  assert.equal(updated.totalPrice, 30);
  assert.equal(updated.totalCost, 24);
  assert.equal(updated.displayQuantity, '3 x 200 g');
  assert.equal(updated.priceTierId, 7);
});
test('repeated pack adjustments do not accumulate quantity conversion errors', () => {
  let line = pack;
  for (let i = 0; i < 30; i++) {
    line = resizeSaleLine(line, 3, 5);
    line = resizeSaleLine(line, 1, 5);
  }
  assert.equal(line.quantity, 0.2);
  assert.equal(line.totalPrice, 10);
});
test('invalid and over-stock edits cannot become bill lines', () => {
  for (const value of [0, -1, NaN, Infinity, 2.1]) assert.equal(resizeSaleLine(rice, value, 2), null);
  assert.equal(maxSaleQuantity(NaN, 0), 0);
  assert.equal(maxSaleQuantity(2, 0, 0), 0);
});
test('removing another line frees its stock without changing stored inventory', () => {
  const stock = 2;
  assert.equal(maxBillLineQuantity(stock, [rice, rice], 0), 1);
  assert.equal(maxBillLineQuantity(stock, [rice], 0), 2);
  assert.equal(stock, 2);
});
test('zero-price and zero-cost products keep their original rates', () => {
  const updated = resizeSaleLine({ ...rice, pricePerUnit: 0, costPerUnit: 0 }, 2, 2);
  assert.equal(updated.totalPrice, 0);
  assert.equal(updated.totalCost, 0);
});
test('a previously rejected draft cannot silently check out when stock becomes available', () => {
  assert.equal(isSaleQuantityApplied(rice, 2, 1), false);
  assert.equal(isSaleQuantityApplied(rice, 2, 2), false);
  assert.equal(isSaleQuantityApplied(resizeSaleLine(rice, 2, 2), 2, 2), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function riceOrder() {
  return {
    id: 1001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ id: 1, sku: 'TEST-001', name: 'Rice', hsn: '1006', price: 2000, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    total: 1942.5
  };
}

test('CURRENT BEHAVIOUR — pricing applies the HSN slab after the capped cart discount', () => {
  const result = pricing.computeTotals(
    [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }],
    'SAVE10'
  );

  assert.equal(result.subtotal, 2000);
  assert.equal(result.discount, 150);
  assert.equal(result.tax, 92.5);
  assert.equal(result.total, 1942.5);
  assert.equal(result.lines[0].gstPercent, 5);
});

test('invoice uses the same HSN tax, capped discount, and total as the order', () => {
  const result = invoice.computeInvoiceFigures(riceOrder());

  assert.equal(result.subtotal, 2000);
  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.rows[0].lineTax, 92.5);
  assert.equal(result.tax, riceOrder().tax);
  assert.equal(result.cgst, 46.25);
  assert.equal(result.sgst, 46.25);
  assert.equal(result.discount, riceOrder().discount);
  assert.equal(result.total, riceOrder().total);
});

test('invoice HTML shows the billed GST and total without a mismatch warning', () => {
  const html = invoice.render(riceOrder());

  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /<td class="r">₹92\.50<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1942\.50<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('GST reconciliation reports no mismatch when invoice matches the order', () => {
  const order = riceOrder();
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 92.5);
  assert.equal(result.rows[0].invoiceTax, 92.5);
  assert.equal(result.rows[0].ledgerTotal, 1942.5);
  assert.equal(result.rows[0].invoiceTotal, 1942.5);
  assert.equal(result.rows[0].matched, true);
});

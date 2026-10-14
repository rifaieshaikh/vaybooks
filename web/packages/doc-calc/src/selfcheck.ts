/**
 * Minimal assert script — run with:
 *   node --experimental-strip-types src/selfcheck.ts
 */
import { computeSalesGst, computeSupplyGst } from './gst.ts';
import {
  applyInvoiceDiscountToLines,
  previewPurchaseLine,
  previewSalesLine,
  resolveInvoiceDiscountAmount,
  resolveLineDiscount,
  taxSummaryFromLines,
} from './lines.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function almostEq(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}

export const __testCases = [
  {
    name: 'intra-state CGST/SGST split',
    run() {
      const gst = computeSupplyGst(100, 18, {
        chargeGst: true,
        businessStateCode: '27',
        partyStateCode: '27',
      });
      assert(almostEq(gst.cgst_amount, 9), `cgst expected 9 got ${gst.cgst_amount}`);
      assert(almostEq(gst.sgst_amount, 9), `sgst expected 9 got ${gst.sgst_amount}`);
      assert(almostEq(gst.igst_amount, 0), 'igst should be 0');
      assert(almostEq(gst.line_total, 118), `line_total expected 118 got ${gst.line_total}`);
    },
  },
  {
    name: 'intra-UT CGST/UTGST',
    run() {
      const gst = computeSalesGst(100, 18, {
        businessRegistered: true,
        businessStateCode: '04',
        customerStateCode: '04',
      });
      assert(almostEq(gst.cgst_amount, 9), `cgst expected 9 got ${gst.cgst_amount}`);
      assert(almostEq(gst.utgst_amount, 9), `utgst expected 9 got ${gst.utgst_amount}`);
      assert(almostEq(gst.sgst_amount, 0), 'sgst should be 0 for UT');
    },
  },
  {
    name: 'inter-state IGST',
    run() {
      const gst = computeSalesGst(200, 12, {
        businessRegistered: true,
        businessStateCode: '27',
        customerStateCode: '29',
      });
      assert(almostEq(gst.igst_amount, 24), `igst expected 24 got ${gst.igst_amount}`);
      assert(almostEq(gst.cgst_amount, 0), 'cgst should be 0');
    },
  },
  {
    name: 'percent line discount capped',
    run() {
      const d = resolveLineDiscount(2, 100, 10, 'percent');
      assert(almostEq(d, 20), `discount expected 20 got ${d}`);
      const capped = resolveLineDiscount(1, 50, 100, 'flat');
      assert(almostEq(capped, 50), `flat discount capped at gross, got ${capped}`);
    },
  },
  {
    name: 'preview sales line',
    run() {
      const p = previewSalesLine({
        qty: 2,
        rate: 100,
        discountInput: 10,
        discountMode: 'flat',
        gstRate: 18,
        businessRegistered: true,
        businessStateCode: '27',
        customerStateCode: '27',
      });
      assert(almostEq(p.discount, 10), `discount ${p.discount}`);
      assert(almostEq(p.taxable_amount, 190), `taxable ${p.taxable_amount}`);
      assert(almostEq(p.line_total, 224.2), `line_total ${p.line_total}`);
    },
  },
  {
    name: 'preview purchase line unregistered',
    run() {
      const p = previewPurchaseLine({
        qty: 1,
        rate: 100,
        gstRate: 18,
        vendorRegistered: false,
        businessStateCode: '27',
        vendorStateCode: '27',
      });
      assert(almostEq(p.taxable_amount, 100), 'taxable');
      assert(almostEq(p.line_total, 100), 'no tax when unregistered');
    },
  },
  {
    name: 'invoice discount weighted + rounding absorb',
    run() {
      const lines = [
        {
          product_id: 'a',
          qty: 2,
          rate: 100,
          discount: 0,
          taxable_amount: 200,
          line_total: 200,
          gst_rate: 0,
        },
        {
          product_id: 'b',
          qty: 1,
          rate: 100,
          discount: 0,
          taxable_amount: 100,
          line_total: 100,
          gst_rate: 0,
        },
        {
          product_id: 'c',
          qty: 1,
          rate: 80,
          discount: 20,
          taxable_amount: 60,
          line_total: 60,
          gst_rate: 0,
        },
      ];
      const adjusted = applyInvoiceDiscountToLines(lines, 30, {
        businessRegistered: false,
        businessStateCode: '27',
        customerStateCode: '27',
      });
      const byId = Object.fromEntries(adjusted.map((l) => [l.product_id, l]));
      assert(almostEq(byId.a.taxable_amount, 180), `a taxable ${byId.a.taxable_amount}`);
      assert(almostEq(byId.b.taxable_amount, 90), `b taxable ${byId.b.taxable_amount}`);
      assert(almostEq(byId.c.taxable_amount, 60), `c taxable ${byId.c.taxable_amount}`);
    },
  },
  {
    name: 'invoice discount percent of eligible base',
    run() {
      const amount = resolveInvoiceDiscountAmount(260, 10, 'percent');
      assert(almostEq(amount, 26), `expected 26 got ${amount}`);
    },
  },
  {
    name: 'tax summary',
    run() {
      const summary = taxSummaryFromLines([
        {
          taxable_amount: 100,
          cgst_amount: 9,
          sgst_amount: 9,
          igst_amount: 0,
          utgst_amount: 0,
          line_total: 118,
        },
        {
          taxable_amount: 50,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 6,
          utgst_amount: 0,
          line_total: 56,
        },
      ]);
      assert(almostEq(summary.taxable, 150), 'taxable');
      assert(almostEq(summary.total_tax, 24), 'total_tax');
      assert(almostEq(summary.grand_total, 174), 'grand_total');
    },
  },
];

for (const tc of __testCases) {
  tc.run();
  console.log(`ok — ${tc.name}`);
}
console.log(`All ${__testCases.length} checks passed.`);

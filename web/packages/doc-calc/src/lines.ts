import {
  computePurchaseGst,
  computeSalesGst,
  round2,
  type GstBreakdown,
} from './gst';

export type DiscountMode = 'flat' | 'percent';

export type TaxableLine = {
  id?: string;
  product_id?: string;
  qty: number;
  rate: number;
  discount?: number;
  discount_mode?: DiscountMode | string;
  discount_input?: number;
  taxable_amount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  utgst_amount?: number;
  line_total?: number;
  gst_rate?: number;
  [key: string]: unknown;
};

export type TaxSummary = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  utgst: number;
  total_tax: number;
  grand_total: number;
};

export type SalesLinePreview = GstBreakdown & {
  discount: number;
  gst_rate: number;
};

export type PurchaseLinePreview = GstBreakdown & {
  gst_rate: number;
};

/** Convert line discount flat ₹ or % into a rupee amount capped at qty×rate. */
export function resolveLineDiscount(
  qty: number,
  rate: number,
  discountInput: number,
  mode: DiscountMode | string = 'flat',
): number {
  const gross = round2(Math.max(Number(qty) || 0, 0) * Math.max(Number(rate) || 0, 0));
  const raw = Math.max(Number(discountInput) || 0, 0);
  const normalized = String(mode || 'flat').trim().toLowerCase();
  let amount: number;
  if (normalized === 'percent' || normalized === '%' || normalized === 'pct') {
    amount = round2((gross * Math.min(raw, 100)) / 100);
  } else {
    amount = round2(raw);
  }
  return round2(Math.min(amount, gross));
}

/** Convert flat ₹ or % input into a rupee discount capped at eligibleBase. */
export function resolveInvoiceDiscountAmount(
  eligibleBase: number,
  input: number,
  mode: DiscountMode | string = 'flat',
): number {
  const base = Math.max(Number(eligibleBase) || 0, 0);
  const raw = Math.max(Number(input) || 0, 0);
  const normalized = String(mode || 'flat').trim().toLowerCase();
  let amount: number;
  if (normalized === 'percent' || normalized === '%' || normalized === 'pct') {
    amount = round2((base * Math.min(raw, 100)) / 100);
  } else {
    amount = round2(raw);
  }
  return round2(Math.min(amount, base));
}

export function previewSalesLine(opts: {
  qty: number;
  rate: number;
  discountInput?: number;
  discountMode?: DiscountMode | string;
  gstRate: number;
  businessRegistered: boolean;
  businessStateCode?: string;
  customerStateCode?: string;
}): SalesLinePreview {
  const discount = resolveLineDiscount(
    opts.qty,
    opts.rate,
    opts.discountInput ?? 0,
    opts.discountMode ?? 'flat',
  );
  const lineGross = round2(Math.max(Number(opts.qty) || 0, 0) * Math.max(Number(opts.rate) || 0, 0));
  const taxable = round2(Math.max(lineGross - discount, 0));
  const gstRate = opts.businessRegistered ? Number(opts.gstRate) || 0 : 0;
  const gst = computeSalesGst(taxable, gstRate, {
    businessRegistered: opts.businessRegistered,
    businessStateCode: opts.businessStateCode,
    customerStateCode: opts.customerStateCode,
  });
  return {
    ...gst,
    discount,
    gst_rate: gstRate,
  };
}

export function previewPurchaseLine(opts: {
  qty: number;
  rate: number;
  gstRate: number;
  vendorRegistered: boolean;
  businessStateCode?: string;
  vendorStateCode?: string;
}): PurchaseLinePreview {
  const taxable = round2(Math.max(Number(opts.qty) || 0, 0) * Math.max(Number(opts.rate) || 0, 0));
  const gstRate = opts.vendorRegistered ? Number(opts.gstRate) || 0 : 0;
  const gst = computePurchaseGst(taxable, gstRate, {
    vendorRegistered: opts.vendorRegistered,
    businessStateCode: opts.businessStateCode,
    vendorStateCode: opts.vendorStateCode,
  });
  return {
    ...gst,
    gst_rate: gstRate,
  };
}

export type InvoiceGstCtx = {
  businessRegistered: boolean;
  businessStateCode?: string;
  customerStateCode?: string;
};

/**
 * Apply invoice discount only to lines without item discount (discount ≤ 0.01),
 * weighted by qty×rate. Last eligible line absorbs rounding remainder; GST recomputed.
 */
export function applyInvoiceDiscountToLines<T extends TaxableLine>(
  lines: T[],
  invoiceDiscount: number,
  gstCtx: InvoiceGstCtx,
): T[] {
  if (!lines.length || invoiceDiscount <= 0) {
    return lines;
  }

  const eligible = lines.filter((line) => Number(line.discount || 0) <= 0.01);
  if (!eligible.length) {
    return lines;
  }

  const weights = new Map<T, number>();
  for (const line of eligible) {
    weights.set(
      line,
      round2(Math.max(Number(line.qty) || 0, 0) * Math.max(Number(line.rate) || 0, 0)),
    );
  }
  const totalWeight = round2([...weights.values()].reduce((a, b) => a + b, 0));
  const eligibleTaxable = round2(
    eligible.reduce((sum, line) => sum + (Number(line.taxable_amount) || 0), 0),
  );
  if (totalWeight <= 0 || eligibleTaxable <= 0) {
    return lines;
  }

  let remainingDiscount = round2(Math.min(Number(invoiceDiscount) || 0, eligibleTaxable));
  if (remainingDiscount <= 0) {
    return lines;
  }

  let allocated = 0;
  const shareByLine = new Map<T, number>();
  eligible.forEach((line, index) => {
    let share: number;
    if (index === eligible.length - 1) {
      share = round2(remainingDiscount - allocated);
    } else {
      share = round2(remainingDiscount * ((weights.get(line) || 0) / totalWeight));
      allocated = round2(allocated + share);
    }
    shareByLine.set(line, Math.min(share, Number(line.taxable_amount) || 0));
  });

  return lines.map((line) => {
    const share = shareByLine.get(line) || 0;
    if (share <= 0) {
      return line;
    }
    const newTaxable = round2(Math.max((Number(line.taxable_amount) || 0) - share, 0));
    const gst = computeSalesGst(newTaxable, Number(line.gst_rate) || 0, {
      businessRegistered: gstCtx.businessRegistered,
      businessStateCode: gstCtx.businessStateCode,
      customerStateCode: gstCtx.customerStateCode,
    });
    return {
      ...line,
      taxable_amount: gst.taxable_amount,
      cgst_amount: gst.cgst_amount,
      sgst_amount: gst.sgst_amount,
      igst_amount: gst.igst_amount,
      utgst_amount: gst.utgst_amount,
      line_total: gst.line_total,
    };
  });
}

export function taxSummaryFromLines(
  lines: Array<{
    taxable_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    igst_amount?: number;
    utgst_amount?: number;
    line_total?: number;
  }>,
): TaxSummary {
  const taxable = round2(lines.reduce((s, l) => s + (Number(l.taxable_amount) || 0), 0));
  const cgst = round2(lines.reduce((s, l) => s + (Number(l.cgst_amount) || 0), 0));
  const sgst = round2(lines.reduce((s, l) => s + (Number(l.sgst_amount) || 0), 0));
  const igst = round2(lines.reduce((s, l) => s + (Number(l.igst_amount) || 0), 0));
  const utgst = round2(lines.reduce((s, l) => s + (Number(l.utgst_amount) || 0), 0));
  const total_tax = round2(cgst + sgst + igst + utgst);
  const grand_total = round2(lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0));
  return { taxable, cgst, sgst, igst, utgst, total_tax, grand_total };
}

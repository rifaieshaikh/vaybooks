/** Union territories that use UTGST (not SGST) on intra-UT supply. */
export const UTGST_STATE_CODES = ['04', '26', '31', '35', '38'] as const;

export type GstBreakdown = {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  utgst_amount: number;
  line_total: number;
};

function emptyGst(taxable = 0): GstBreakdown {
  return {
    taxable_amount: taxable,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    utgst_amount: 0,
    line_total: taxable,
  };
}

function withLineTotal(parts: Omit<GstBreakdown, 'line_total'>): GstBreakdown {
  const total_tax = round2(
    parts.cgst_amount + parts.sgst_amount + parts.igst_amount + parts.utgst_amount,
  );
  return {
    ...parts,
    line_total: round2(parts.taxable_amount + total_tax),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeSupplyGst(
  taxableAmount: number,
  gstRate: number,
  opts: {
    chargeGst: boolean;
    businessStateCode?: string;
    partyStateCode?: string;
  },
): GstBreakdown {
  const taxable = round2(Math.max(Number(taxableAmount) || 0, 0));
  if (taxable <= 0) {
    return emptyGst(0);
  }

  if (!opts.chargeGst || !gstRate) {
    return emptyGst(taxable);
  }

  const rate = Number(gstRate) || 0;
  const biz = (opts.businessStateCode || '').trim().padStart(2, '0');
  const party = (opts.partyStateCode || '').trim().padStart(2, '0');
  const totalTax = round2((taxable * rate) / 100);

  if (biz && party && biz === party) {
    const half = round2(totalTax / 2);
    const remainder = round2(totalTax - half);
    if ((UTGST_STATE_CODES as readonly string[]).includes(biz)) {
      return withLineTotal({
        taxable_amount: taxable,
        cgst_amount: half,
        sgst_amount: 0,
        igst_amount: 0,
        utgst_amount: remainder,
      });
    }
    return withLineTotal({
      taxable_amount: taxable,
      cgst_amount: half,
      sgst_amount: remainder,
      igst_amount: 0,
      utgst_amount: 0,
    });
  }

  return withLineTotal({
    taxable_amount: taxable,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: totalTax,
    utgst_amount: 0,
  });
}

export function computeSalesGst(
  taxableAmount: number,
  gstRate: number,
  opts: {
    businessRegistered: boolean;
    businessStateCode?: string;
    customerStateCode?: string;
  },
): GstBreakdown {
  return computeSupplyGst(taxableAmount, gstRate, {
    chargeGst: opts.businessRegistered,
    businessStateCode: opts.businessStateCode,
    partyStateCode: opts.customerStateCode,
  });
}

export function computePurchaseGst(
  taxableAmount: number,
  gstRate: number,
  opts: {
    vendorRegistered: boolean;
    businessStateCode?: string;
    vendorStateCode?: string;
  },
): GstBreakdown {
  return computeSupplyGst(taxableAmount, gstRate, {
    chargeGst: opts.vendorRegistered,
    businessStateCode: opts.businessStateCode,
    partyStateCode: opts.vendorStateCode,
  });
}

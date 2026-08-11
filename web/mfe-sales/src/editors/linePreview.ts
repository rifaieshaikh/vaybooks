import {
  applyInvoiceDiscountToLines,
  previewSalesLine,
  resolveInvoiceDiscountAmount,
  taxSummaryFromLines,
  type DiscountMode,
  type TaxSummary,
  type TaxableLine,
} from '@vaybooks/doc-calc';
import type { EditorLineItem, LineProductOption } from '@vaybooks/ui-kit';

export type GstPreviewCtx = {
  businessRegistered: boolean;
  businessStateCode?: string;
  customerStateCode?: string;
};

export function canEditInvoiceMonth(dateStr: string | undefined | null): boolean {
  if (!dateStr) return true;
  const raw = String(dateStr).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapProductsToLineOptions(
  products: Record<string, unknown>[],
): LineProductOption[] {
  return products.map((p) => {
    const id = String(p.id ?? '');
    const label = String(p.name ?? p.product_name ?? id);
    const hsn = String(p.hsn_sac ?? p.hsn ?? '') || undefined;
    const gstRate = Number(p.gst_rate ?? 0) || 0;
    const rate = Number(p.selling_rate ?? p.rate ?? 0) || 0;
    const stock = Number(p.stock_on_hand ?? p.stock ?? p.qty_on_hand ?? NaN);
    return {
      id,
      label,
      hsn,
      gstRate,
      rate,
      stock: Number.isFinite(stock) ? stock : undefined,
    };
  });
}

export function newEditorLine(): EditorLineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    qty: 1,
    rate: 0,
    discountInput: 0,
    discountMode: 'flat',
    discount: 0,
    hsn: '',
    taxable: 0,
    gstRate: 0,
    tax: 0,
    total: 0,
  };
}

export function mapApiLinesToEditor(raw: unknown): EditorLineItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((row, index) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const modeRaw = String(r.discount_mode ?? 'flat').toLowerCase();
    const discountMode: DiscountMode = modeRaw === 'percent' || modeRaw === '%' ? 'percent' : 'flat';
    const discountInput = Number(
      r.discount_input != null ? r.discount_input : r.discount ?? 0,
    );
    return {
      id: String(r.id ?? `line-${index}-${String(r.product_id ?? index)}`),
      productId: String(r.product_id ?? ''),
      qty: Number(r.qty ?? r.qty_ordered ?? r.qty_delivered ?? 0) || 0,
      rate: Number(r.rate ?? 0) || 0,
      discountInput: Number.isFinite(discountInput) ? discountInput : 0,
      discountMode,
      discount: Number(r.discount ?? 0) || 0,
      hsn: String(r.hsn_sac ?? r.hsn ?? ''),
      taxable: Number(r.taxable_amount ?? r.taxable ?? 0) || 0,
      gstRate: Number(r.gst_rate ?? 0) || 0,
      tax:
        Number(r.total_tax ?? 0) ||
        Number(r.cgst_amount ?? 0) +
          Number(r.sgst_amount ?? 0) +
          Number(r.igst_amount ?? 0) +
          Number(r.utgst_amount ?? 0) ||
        0,
      total: Number(r.line_total ?? r.total ?? 0) || 0,
    };
  });
}

function toTaxableLines(lines: EditorLineItem[], ctx: GstPreviewCtx): TaxableLine[] {
  return lines
    .filter((l) => l.productId)
    .map((line) => {
      const preview = previewSalesLine({
        qty: line.qty,
        rate: line.rate,
        discountInput: line.discountInput ?? 0,
        discountMode: line.discountMode ?? 'flat',
        gstRate: line.gstRate ?? 0,
        businessRegistered: ctx.businessRegistered,
        businessStateCode: ctx.businessStateCode,
        customerStateCode: ctx.customerStateCode,
      });
      return {
        id: line.id,
        product_id: line.productId,
        qty: line.qty,
        rate: line.rate,
        discount: preview.discount,
        discount_mode: line.discountMode ?? 'flat',
        discount_input: line.discountInput ?? 0,
        taxable_amount: preview.taxable_amount,
        cgst_amount: preview.cgst_amount,
        sgst_amount: preview.sgst_amount,
        igst_amount: preview.igst_amount,
        utgst_amount: preview.utgst_amount,
        line_total: preview.line_total,
        gst_rate: preview.gst_rate,
        hsn: line.hsn,
      };
    });
}

function fromTaxableLines(
  source: EditorLineItem[],
  taxed: TaxableLine[],
): EditorLineItem[] {
  const byId = new Map(taxed.map((t) => [String(t.id ?? t.product_id), t]));
  return source.map((line) => {
    if (!line.productId) return line;
    const t = byId.get(line.id) || byId.get(line.productId);
    if (!t) return line;
    const tax =
      Number(t.cgst_amount ?? 0) +
      Number(t.sgst_amount ?? 0) +
      Number(t.igst_amount ?? 0) +
      Number(t.utgst_amount ?? 0);
    return {
      ...line,
      discount: Number(t.discount ?? 0) || 0,
      taxable: Number(t.taxable_amount ?? 0) || 0,
      gstRate: Number(t.gst_rate ?? line.gstRate ?? 0) || 0,
      tax,
      total: Number(t.line_total ?? 0) || 0,
    };
  });
}

export function recomputeSalesLines(
  lines: EditorLineItem[],
  ctx: GstPreviewCtx,
  invoiceDiscount?: { input: number; mode: DiscountMode },
): { lines: EditorLineItem[]; summary: TaxSummary; invoiceDiscountAmount: number } {
  let taxed = toTaxableLines(lines, ctx);
  let invoiceDiscountAmount = 0;
  if (invoiceDiscount && invoiceDiscount.input > 0) {
    const eligibleBase = taxed
      .filter((l) => Number(l.discount || 0) <= 0.01)
      .reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
    invoiceDiscountAmount = resolveInvoiceDiscountAmount(
      eligibleBase,
      invoiceDiscount.input,
      invoiceDiscount.mode,
    );
    taxed = applyInvoiceDiscountToLines(taxed, invoiceDiscountAmount, ctx);
  }
  const next = fromTaxableLines(lines, taxed);
  return {
    lines: next,
    summary: taxSummaryFromLines(taxed),
    invoiceDiscountAmount,
  };
}

export function editorLinesToPayload(
  lines: EditorLineItem[],
  locationId?: string,
): Record<string, unknown>[] {
  return lines
    .filter((l) => l.productId && Number(l.qty) > 0)
    .map((l) => ({
      product_id: l.productId,
      sku_id: l.productId,
      qty: Number(l.qty) || 0,
      rate: Number(l.rate) || 0,
      discount: Number(l.discount ?? 0) || 0,
      discount_mode: l.discountMode ?? 'flat',
      discount_input: Number(l.discountInput ?? 0) || 0,
      ...(locationId ? { location_id: locationId } : {}),
    }));
}

export function buildCustomerPriceMap(
  prices: Record<string, unknown>[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of prices) {
    const pid = String(row.product_id ?? '');
    if (!pid) continue;
    const rate = Number(row.rate ?? row.selling_rate ?? row.price ?? NaN);
    if (Number.isFinite(rate)) map.set(pid, rate);
  }
  return map;
}

export function applyDiscountRulesToLines(
  lines: EditorLineItem[],
  rules: Record<string, unknown>[],
  customerId?: string,
): EditorLineItem[] {
  const active = rules
    .filter((r) => r.is_active !== false && r.active !== false)
    .slice()
    .sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));

  return lines.map((line) => {
    if (!line.productId) return line;
    for (const rule of active) {
      const scope = String(rule.scope ?? 'global').toLowerCase();
      const productIds = Array.isArray(rule.product_ids)
        ? (rule.product_ids as unknown[]).map(String)
        : rule.product_id
          ? [String(rule.product_id)]
          : [];
      const customerIds = Array.isArray(rule.customer_ids)
        ? (rule.customer_ids as unknown[]).map(String)
        : rule.customer_id
          ? [String(rule.customer_id)]
          : [];

      let matches = false;
      if (scope === 'global' || scope === 'seasonal') {
        matches = true;
      } else if (scope === 'product') {
        matches = productIds.includes(line.productId);
      } else if (scope === 'customer') {
        matches = Boolean(customerId && customerIds.includes(customerId));
      } else if (productIds.length && productIds.includes(line.productId)) {
        matches = true;
      } else if (!productIds.length && !customerIds.length) {
        matches = true;
      }

      if (customerIds.length && customerId && !customerIds.includes(customerId)) {
        matches = false;
      }

      if (!matches) continue;

      const dtype = String(rule.discount_type ?? rule.type ?? 'percent').toLowerCase();
      const value = Number(rule.value ?? rule.discount_value ?? 0) || 0;
      if (value <= 0) continue;
      return {
        ...line,
        discountInput: value,
        discountMode: dtype === 'flat' || dtype === 'amount' ? 'flat' : 'percent',
      };
    }
    return line;
  });
}

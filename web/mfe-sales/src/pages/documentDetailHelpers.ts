import type { DocumentDetailFact, DocumentDetailLine } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';

export function statusIncludes(status: unknown, ...needles: string[]): boolean {
  const s = String(status || '').toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

export function dateCaption(value: unknown): string {
  const raw = asCaption(value);
  if (!raw) return '';
  return raw.slice(0, 10);
}

/** Build fact grid rows; skips empty values. */
export function buildFacts(
  entries: Array<[string, unknown] | null | undefined | false>,
): DocumentDetailFact[] {
  const out: DocumentDetailFact[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    const [label, raw] = entry;
    if (raw == null || raw === '') continue;
    if (typeof raw === 'number' && !Number.isFinite(raw)) continue;
    const value =
      typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw)
        : asCaption(raw);
    if (!value || value === '—') continue;
    out.push({ label, value });
  }
  return out;
}

export function mapDocLines(raw: unknown): DocumentDetailLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, index) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const name =
      asCaption(r.product_name) ||
      asCaption(r.item_name) ||
      asCaption(r.description) ||
      asCaption(r.product_id) ||
      `Line ${index + 1}`;
    const qty = Number(
      r.qty ?? r.qty_ordered ?? r.qty_delivered ?? r.qty_received ?? r.quantity ?? NaN,
    );
    const rate = Number(r.rate ?? r.unit_price ?? NaN);
    const discount = Number(r.discount ?? r.line_discount ?? NaN);
    const amount = Number(r.line_total ?? r.amount ?? r.total ?? NaN);
    const gstRate = Number(r.gst_rate ?? r.tax_rate ?? r.gst ?? NaN);
    const tax = Number(r.tax_amount ?? r.tax ?? r.gst_amount ?? NaN);
    const hsn = asCaption(r.hsn_sac || r.hsn) || undefined;

    const metaParts: string[] = [];
    if (r.qty_received != null && (r.qty_ordered != null || r.qty != null)) {
      metaParts.push(`Received ${Number(r.qty_received ?? 0)}`);
    }
    if (r.qty_delivered != null && (r.qty_ordered != null || r.qty != null)) {
      metaParts.push(`Delivered ${Number(r.qty_delivered ?? 0)}`);
    }
    const uom = asCaption(r.uom || r.unit);
    if (uom) metaParts.push(uom);

    return {
      id: String(r.id ?? r.product_id ?? index),
      name,
      qty: Number.isFinite(qty) ? qty : undefined,
      rate: Number.isFinite(rate) ? rate : undefined,
      discount: Number.isFinite(discount) && discount > 0 ? discount : undefined,
      amount: Number.isFinite(amount) ? amount : undefined,
      hsn,
      gstRate: Number.isFinite(gstRate) && gstRate > 0 ? gstRate : undefined,
      tax: Number.isFinite(tax) && tax > 0 ? tax : undefined,
      meta: metaParts.length ? metaParts.join(' · ') : undefined,
    };
  });
}

export function moneySummaryFromDoc(
  data: Record<string, unknown>,
): { label: string; value: number }[] {
  const num = (...keys: string[]) => {
    for (const k of keys) {
      if (data[k] != null && data[k] !== '') {
        const n = Number(data[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  };
  const rows: { label: string; value: number }[] = [];
  const taxable = num('taxable', 'taxable_amount', 'subtotal');
  const discount = num('invoice_discount', 'discount', 'total_discount');
  const cgst = num('cgst', 'cgst_amount');
  const sgst = num('sgst', 'sgst_amount');
  const igst = num('igst', 'igst_amount');
  const tax = num('total_tax', 'tax');
  const roundOff = num('round_off', 'roundoff');
  const paid = num('amount_paid', 'paid_amount', 'paid');
  const balance = num('balance_due', 'balance', 'amount_due');
  const grand = num('net', 'grand_total', 'total_amount', 'total', 'gross', 'amount');

  if (taxable != null) rows.push({ label: 'Taxable', value: taxable });
  if (discount != null && Math.abs(discount) > 0) rows.push({ label: 'Discount', value: discount });
  if (cgst != null && cgst > 0) rows.push({ label: 'CGST', value: cgst });
  if (sgst != null && sgst > 0) rows.push({ label: 'SGST', value: sgst });
  if (igst != null && igst > 0) rows.push({ label: 'IGST', value: igst });
  if (tax != null && cgst == null && sgst == null && igst == null) {
    rows.push({ label: 'Tax', value: tax });
  }
  if (roundOff != null && Math.abs(roundOff) > 0.001) {
    rows.push({ label: 'Round off', value: roundOff });
  }
  if (grand != null) rows.push({ label: 'Grand total', value: grand });
  if (paid != null && paid > 0) rows.push({ label: 'Paid', value: paid });
  if (balance != null && Math.abs(balance) > 0.001) {
    rows.push({ label: 'Balance due', value: balance });
  }
  return rows;
}

export function notesFromDoc(data: Record<string, unknown>): string | undefined {
  const notes =
    asCaption(data.notes) ||
    asCaption(data.narration) ||
    asCaption(data.description) ||
    asCaption(data.remarks);
  return notes || undefined;
}

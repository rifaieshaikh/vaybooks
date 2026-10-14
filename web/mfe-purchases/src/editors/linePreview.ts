import {
  previewPurchaseLine,
  taxSummaryFromLines,
  type TaxSummary,
} from '@vaybooks/doc-calc';
import type { EditorLineItem, LineProductOption } from '@vaybooks/ui-kit';

export type PurchaseGstCtx = {
  vendorRegistered: boolean;
  businessStateCode?: string;
  vendorStateCode?: string;
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
    const rate = Number(p.last_purchase_rate ?? p.purchase_rate ?? p.rate ?? 0) || 0;
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

export function mapServicesToLineOptions(
  services: Record<string, unknown>[],
): LineProductOption[] {
  return services.map((s) => {
    const id = String(s.id ?? '');
    const label = String(s.name ?? s.service_name ?? id);
    const hsn = String(s.hsn_sac ?? s.hsn ?? '') || undefined;
    const gstRate = Number(s.gst_rate ?? 0) || 0;
    const rate = Number(s.rate ?? s.default_rate ?? s.price ?? 0) || 0;
    return {
      id,
      label,
      hsn,
      gstRate,
      rate,
    };
  });
}

function lineHasItem(line: EditorLineItem): boolean {
  return Boolean(line.productId || line.serviceId);
}

export function newEditorLine(): EditorLineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    itemType: 'product',
    serviceId: '',
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
    const productId = String(r.product_id ?? '');
    const serviceId = String(r.service_id ?? '');
    const rawType = String(r.item_type ?? r.line_type ?? '').toLowerCase();
    const itemType: 'product' | 'service' =
      rawType === 'service' || (Boolean(serviceId) && !productId) ? 'service' : 'product';
    return {
      id: String(r.id ?? `line-${index}-${productId || serviceId || index}`),
      productId: itemType === 'product' ? productId : '',
      serviceId: itemType === 'service' ? serviceId : '',
      itemType,
      qty: Number(r.qty ?? r.qty_ordered ?? r.qty_received ?? 0) || 0,
      rate: Number(r.rate ?? 0) || 0,
      discountInput: 0,
      discountMode: 'flat',
      discount: 0,
      hsn: String(r.hsn_sac ?? r.hsn ?? ''),
      taxable: Number(r.taxable_amount ?? r.taxable ?? r.amount ?? 0) || 0,
      gstRate: Number(r.gst_rate ?? 0) || 0,
      tax:
        Number(r.total_tax ?? 0) ||
        Number(r.cgst_amount ?? 0) +
          Number(r.sgst_amount ?? 0) +
          Number(r.igst_amount ?? 0) +
          Number(r.utgst_amount ?? 0) ||
        0,
      total: Number(r.line_total ?? r.total ?? r.amount ?? 0) || 0,
    };
  });
}

export function recomputePurchaseLines(
  lines: EditorLineItem[],
  ctx: PurchaseGstCtx,
): { lines: EditorLineItem[]; summary: TaxSummary } {
  const taxed = lines
    .filter((l) => lineHasItem(l))
    .map((line) => {
      const preview = previewPurchaseLine({
        qty: line.qty,
        rate: line.rate,
        gstRate: line.gstRate ?? 0,
        vendorRegistered: ctx.vendorRegistered,
        businessStateCode: ctx.businessStateCode,
        vendorStateCode: ctx.vendorStateCode,
      });
      return {
        id: line.id,
        product_id: line.productId,
        service_id: line.serviceId,
        qty: line.qty,
        rate: line.rate,
        taxable_amount: preview.taxable_amount,
        cgst_amount: preview.cgst_amount,
        sgst_amount: preview.sgst_amount,
        igst_amount: preview.igst_amount,
        utgst_amount: preview.utgst_amount,
        line_total: preview.line_total,
        gst_rate: preview.gst_rate,
      };
    });

  const byId = new Map(taxed.map((t) => [String(t.id), t]));
  const next = lines.map((line) => {
    if (!lineHasItem(line)) return line;
    const t = byId.get(line.id);
    if (!t) return line;
    const tax =
      Number(t.cgst_amount ?? 0) +
      Number(t.sgst_amount ?? 0) +
      Number(t.igst_amount ?? 0) +
      Number(t.utgst_amount ?? 0);
    return {
      ...line,
      taxable: Number(t.taxable_amount ?? 0) || 0,
      gstRate: Number(t.gst_rate ?? line.gstRate ?? 0) || 0,
      tax,
      total: Number(t.line_total ?? 0) || 0,
    };
  });

  return { lines: next, summary: taxSummaryFromLines(taxed) };
}

export function editorLinesToBillPayload(lines: EditorLineItem[]): Record<string, unknown>[] {
  return lines
    .filter((l) => lineHasItem(l) && Number(l.qty) > 0)
    .map((l) => {
      const base = {
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        taxable_amount: Number(l.taxable ?? 0) || undefined,
        amount: Number(l.total ?? 0) || undefined,
      };
      if (l.itemType === 'service' || (l.serviceId && !l.productId)) {
        return {
          service_id: l.serviceId,
          ...base,
        };
      }
      return {
        product_id: l.productId,
        sku_id: l.productId,
        ...base,
      };
    });
}

export function editorLinesToPoPayload(lines: EditorLineItem[]): Record<string, unknown>[] {
  return lines
    .filter((l) => l.productId && Number(l.qty) > 0)
    .map((l) => ({
      product_id: l.productId,
      sku_id: l.productId,
      qty_ordered: Number(l.qty) || 0,
      rate: Number(l.rate) || 0,
    }));
}

export function editorLinesToReturnPayload(lines: EditorLineItem[]): Record<string, unknown>[] {
  return lines
    .filter((l) => l.productId && Number(l.qty) > 0)
    .map((l) => ({
      product_id: l.productId,
      sku_id: l.productId,
      qty: Number(l.qty) || 0,
      rate: Number(l.rate) || 0,
    }));
}

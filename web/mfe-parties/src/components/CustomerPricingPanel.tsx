import { StatusPill } from '@vaybooks/ui-kit';
import { useCan, useListDiscountRulesQuery } from '@vaybooks/store';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const APPLY_LABELS: Record<string, string> = {
  sales_order: 'Sales order',
  sales_invoice: 'Sales invoice',
  boutique_invoice: 'Boutique invoice',
};

function money(v: unknown) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function valueCaption(row: Record<string, unknown>) {
  const n = Number(row.value) || 0;
  if (String(row.discount_type) === 'fixed') return money(n);
  return `${n}%`;
}

function applyToCaption(row: Record<string, unknown>) {
  const apply = Array.isArray(row.apply_to) ? (row.apply_to as string[]) : [];
  if (!apply.length) return '—';
  return apply.map((k) => APPLY_LABELS[k] || k).join(', ');
}

function validityCaption(row: Record<string, unknown>) {
  const from = row.valid_from ? String(row.valid_from).slice(0, 10) : '';
  const to = row.valid_to ? String(row.valid_to).slice(0, 10) : '';
  if (!from && !to) return 'Always';
  return `${from || '…'} → ${to || '…'}`;
}

type DiscountRow = Record<string, unknown> & { _source: 'Customer' | 'Segment' };

export function CustomerPricingPanel({
  customerId,
  segmentIds,
}: {
  customerId: string;
  segmentIds: string[];
}) {
  const can = useCan();
  const canViewDiscounts = can('settings.discounts.view');
  const canEditDiscounts = can('settings.discounts.edit');

  const discounts = useListDiscountRulesQuery(
    { customer_id: customerId },
    { skip: !canViewDiscounts },
  );
  const allDiscounts = useListDiscountRulesQuery(undefined, { skip: !canViewDiscounts });

  const rows = useMemo(() => {
    const customerRows: DiscountRow[] = (discounts.data || []).map((r) => ({
      ...r,
      _source: 'Customer' as const,
    }));
    const customerIds = new Set(customerRows.map((r) => String(r.id)));
    const segmentRows: DiscountRow[] = (allDiscounts.data || [])
      .filter((r) => {
        if (customerIds.has(String(r.id))) return false;
        const segs = Array.isArray(r.segment_ids) ? (r.segment_ids as string[]) : [];
        return segs.some((s) => segmentIds.includes(String(s)));
      })
      .map((r) => ({ ...r, _source: 'Segment' as const }));
    return [...customerRows, ...segmentRows].sort(
      (a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999),
    );
  }, [discounts.data, allDiscounts.data, segmentIds]);

  if (!canViewDiscounts) return null;

  const settingsHref = canEditDiscounts
    ? `/settings/discounts?new=1&customer_id=${encodeURIComponent(customerId)}`
    : '/settings/discounts';
  const loading = discounts.isLoading || allDiscounts.isLoading;
  const errored = Boolean(discounts.error || allDiscounts.error);

  return (
    <>
      {loading ? <p className="cd-empty">Loading discounts…</p> : null}
      {errored ? (
        <p className="cd-empty" style={{ color: 'var(--cd-danger, #a12828)' }}>
          Failed to load discount rules.
        </p>
      ) : null}
      {!loading && !errored && rows.length === 0 ? (
        <div className="cd-empty">
          <p style={{ margin: '0 0 0.65rem' }}>No discount rules for this customer.</p>
          <Link className="cd-text-link" to={settingsHref}>
            {canEditDiscounts ? 'Add a rule in Discount settings' : 'Open Discount settings'}
          </Link>
        </div>
      ) : null}
      {!loading && !errored && rows.length > 0 ? (
        <div className="cd-table-wrap">
          <table className="cd-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Value</th>
                <th>Applies to</th>
                <th>Source</th>
                <th>Priority</th>
                <th>Validity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r._source}-${String(r.id)}`}>
                  <td>
                    <div className="cd-disc-name">{String(r.name || '—')}</div>
                    <div className="cd-disc-sub">
                      {String(r.discount_type) === 'fixed' ? 'Fixed' : 'Percent'}
                    </div>
                  </td>
                  <td>{valueCaption(r)}</td>
                  <td>{applyToCaption(r)}</td>
                  <td>{r._source}</td>
                  <td>{String(r.priority ?? '—')}</td>
                  <td>{validityCaption(r)}</td>
                  <td>
                    <StatusPill
                      status={r.is_active === false ? 'Inactive' : 'Active'}
                      tone={r.is_active === false ? 'neutral' : 'success'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

export function customerDiscountSettingsHref(customerId: string, canEdit: boolean) {
  return canEdit
    ? `/settings/discounts?new=1&customer_id=${encodeURIComponent(customerId)}`
    : '/settings/discounts';
}

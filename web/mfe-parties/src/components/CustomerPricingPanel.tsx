import { Button, FormRow, TextInput, ErrorText } from '@vaybooks/ui-kit';
import {
  useCan,
  useCreateCustomerPriceMutation,
  useCreateDiscountRuleMutation,
  useListCustomerPricesQuery,
  useListDiscountRulesQuery,
  useListInventoryProductsQuery,
} from '@vaybooks/store';
import { useMemo, useState } from 'react';

function money(v: unknown) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CustomerPricingPanel({
  customerId,
  customerName,
  segmentIds,
  onSeeAllPrices,
}: {
  customerId: string;
  customerName: string;
  segmentIds: string[];
  onSeeAllPrices?: () => void;
}) {
  const can = useCan();
  const canViewDiscounts = can('settings.discounts.view');
  const canEditDiscounts = can('settings.discounts.edit');
  const canViewPrices = can('inventory.customer_prices.view');
  const canEditPrices = can('inventory.customer_prices.edit');

  const discounts = useListDiscountRulesQuery(
    { customer_id: customerId },
    { skip: !canViewDiscounts },
  );
  const allDiscounts = useListDiscountRulesQuery(undefined, { skip: !canViewDiscounts });
  const prices = useListCustomerPricesQuery(
    { customer_id: customerId },
    { skip: !canViewPrices },
  );
  const products = useListInventoryProductsQuery(
    { active_only: true },
    { skip: !canEditPrices },
  );
  const [createDiscount] = useCreateDiscountRuleMutation();
  const [createPrice] = useCreateCustomerPriceMutation();

  const [discName, setDiscName] = useState('');
  const [discValue, setDiscValue] = useState('5');
  const [productId, setProductId] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');

  const segmentRules = useMemo(() => {
    const rows = allDiscounts.data || [];
    return rows.filter((r) => {
      const segs = Array.isArray(r.segment_ids) ? (r.segment_ids as string[]) : [];
      return segs.some((s) => segmentIds.includes(String(s)));
    });
  }, [allDiscounts.data, segmentIds]);

  const latestPrices = useMemo(() => (prices.data || []).slice(0, 3), [prices.data]);

  if (!canViewDiscounts && !canViewPrices) return null;

  async function addDiscount() {
    setError('');
    try {
      await createDiscount({
        name: discName || `${customerName} discount`,
        scope: 'customer',
        discount_type: 'percent',
        value: Number(discValue) || 0,
        customer_ids: [customerId],
        is_active: true,
      }).unwrap();
      setDiscName('');
      discounts.refetch();
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { detail?: string } }).data?.detail || 'Failed')
          : 'Failed',
      );
    }
  }

  async function addPrice() {
    setError('');
    try {
      const prod = (products.data || []).find((p) => String(p.id) === productId);
      await createPrice({
        customer_id: customerId,
        customer_name: customerName,
        product_id: productId,
        product_name: prod ? String(prod.name || '') : '',
        sku: prod ? String(prod.sku || '') : '',
        rate: Number(rate) || 0,
      }).unwrap();
      setProductId('');
      setRate('');
      prices.refetch();
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { detail?: string } }).data?.detail || 'Failed')
          : 'Failed',
      );
    }
  }

  return (
    <div className="cd-pricing">
      {error ? <ErrorText>{error}</ErrorText> : null}

      {canViewDiscounts ? (
        <section className="cd-pricing-card">
          <h4>Customer discount rules</h4>
          <ul className="cd-pricing-list">
            {(discounts.data || []).map((r) => (
              <li key={String(r.id)}>
                {String(r.name)} — {String(r.discount_type)} {String(r.value)}
                {r.is_active === false ? ' (inactive)' : ''}
              </li>
            ))}
            {(discounts.data || []).length === 0 ? <li>No customer-specific rules.</li> : null}
          </ul>
          {segmentRules.length > 0 ? (
            <>
              <h4>Segment-inherited (read-only)</h4>
              <ul className="cd-pricing-list">
                {segmentRules.map((r) => (
                  <li key={`seg-${String(r.id)}`}>
                    {String(r.name)} — {String(r.discount_type)} {String(r.value)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {canEditDiscounts ? (
            <div className="cd-pricing-form">
              <FormRow label="Rule name">
                <TextInput value={discName} onChange={(e) => setDiscName(e.target.value)} />
              </FormRow>
              <FormRow label="Percent">
                <TextInput type="number" value={discValue} onChange={(e) => setDiscValue(e.target.value)} />
              </FormRow>
              <Button type="button" onClick={() => void addDiscount()}>
                Add discount
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {canViewPrices ? (
        <section className="cd-pricing-card">
          <div className="cd-pricing-card-head">
            <h4>Latest product rates</h4>
            {onSeeAllPrices ? (
              <button type="button" className="cd-text-link" onClick={onSeeAllPrices}>
                See all
              </button>
            ) : null}
          </div>
          <ul className="cd-pricing-list">
            {latestPrices.map((r) => (
              <li key={String(r.id)}>
                {String(r.product_name || r.sku || r.product_id)} — {money(r.customer_rate ?? r.rate)}
              </li>
            ))}
            {latestPrices.length === 0 ? <li>No customer prices.</li> : null}
          </ul>
          {canEditPrices ? (
            <div className="cd-pricing-form">
              <FormRow label="Product">
                <select
                  className="cd-select"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {(products.data || []).map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.name || p.sku || p.id)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Rate">
                <TextInput type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
              </FormRow>
              <Button type="button" onClick={() => void addPrice()} disabled={!productId}>
                Add rate
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { EditorLineItem } from '@vaybooks/ui-kit';
import {
  DocumentEditor,
  FormRow,
  LineItemsGrid,
  MoneySummary,
  SearchableSelect,
  TextArea,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreateSalesOrderMutation,
  useGetBusinessProfileQuery,
  useGetCustomerQuery,
  useGetSalesOrderQuery,
  useListCommissionAgentsQuery,
  useListCustomerPricesQuery,
  useListCustomersQuery,
  useListInventorySkusQuery,
  useListWorkersQuery,
  useUpdateSalesOrderMutation,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import {
  buildCustomerPriceMap,
  editorLinesToPayload,
  mapApiLinesToEditor,
  mapProductsToLineOptions,
  recomputeSalesLines,
  todayISO,
} from './linePreview';
import {
  resolveDocLocationId,
  useWorkingLocation,
} from './useWorkingLocation';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function OrderEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading } = useGetSalesOrderQuery(editId, { skip: !editId });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventorySkusQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { data: agents = [] } = useListCommissionAgentsQuery();
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const { locationId: workingLocationId } = useWorkingLocation();
  const [createOrder, createState] = useCreateSalesOrderMutation();
  const [updateOrder, updateState] = useUpdateSalesOrderMutation();

  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState('');
  const [existingLocationId, setExistingLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [commissionIds, setCommissionIds] = useState<string[]>([]);
  const [salesRepIds, setSalesRepIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);

  const { data: customerDetail } = useGetCustomerQuery(customerId, { skip: !customerId });
  const { data: customerPrices = [] } = useListCustomerPricesQuery(
    customerId ? { customer_id: customerId } : undefined,
    { skip: !customerId },
  );

  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const priceMap = useMemo(() => buildCustomerPriceMap(customerPrices), [customerPrices]);

  const gstCtx = useMemo(
    () => ({
      businessRegistered: Boolean(business?.gstin) || business?.gst_registered === true,
      businessStateCode: String(business?.state_code ?? '') || undefined,
      customerStateCode: String(customerDetail?.state_code ?? '') || undefined,
    }),
    [business, customerDetail],
  );

  const { lines: previewLines, summary } = useMemo(
    () => recomputeSalesLines(lines, gstCtx),
    [lines, gstCtx],
  );

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setCustomerId(String(existing.customer_id || params.get('customer_id') || ''));
    setOrderDate(String(existing.order_date || todayISO()).slice(0, 10));
    setExpectedDate(String(existing.expected_date || '').slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setNotes(String(existing.notes || ''));
    setCommissionIds(
      Array.isArray(existing.commission_agent_ids)
        ? existing.commission_agent_ids.map(String)
        : [],
    );
    setSalesRepIds(
      Array.isArray(existing.sales_rep_ids) ? existing.sales_rep_ids.map(String) : [],
    );
    setLines(mapApiLinesToEditor(existing.lines));
    setHydrated(true);
  }, [existing, isEdit, hydrated, params]);

  function onProductSelected(index: number, productId: string) {
    const product = productOptions.find((p) => p.id === productId);
    const rate = priceMap.get(productId) ?? product?.rate ?? 0;
    setLines((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        productId,
        rate,
        hsn: product?.hsn || '',
        gstRate: product?.gstRate ?? 0,
      };
      return next;
    });
  }

  async function onSave() {
    setError(null);
    try {
      if (!customerId) {
        setError('Select a customer.');
        return;
      }
      if (!isEdit && !locationId) {
        setError('Set a working location before saving.');
        return;
      }
      const payloadLines = editorLinesToPayload(previewLines, locationId);
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      const body: Record<string, unknown> = {
        customer_id: customerId,
        order_date: orderDate || undefined,
        expected_date: expectedDate || undefined,
        notes,
        location_id: locationId,
        commission_agent_ids: commissionIds,
        sales_rep_ids: salesRepIds,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updateOrder({ id: editId, body }).unwrap();
        navigate(`/sales/orders/${saved.id || editId}`);
      } else {
        const created = await createOrder(body).unwrap();
        navigate(`/sales/orders/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && isLoading) return <p>Loading order…</p>;

  return (
    <DocumentEditor
      title={isEdit ? 'Edit sales order' : 'New sales order'}
      onCancel={() => navigate(isEdit ? `/sales/orders/${editId}` : '/sales/orders')}
      onSave={onSave}
      saving={createState.isLoading || updateState.isLoading}
      error={error}
      saveLabel={isEdit ? 'Update order' : 'Create order'}
      body={
        <LineItemsGrid
          lines={previewLines}
          products={productOptions}
          showDiscount
          onChange={setLines}
          onProductSelected={onProductSelected}
        />
      }
      footer={
        <MoneySummary
          items={[
            { label: 'Taxable', value: summary.taxable },
            { label: 'Tax', value: summary.total_tax },
            { label: 'Total', value: summary.grand_total },
          ]}
        />
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        <FormRow label="Customer *">
          <SearchableSelect
            options={customers.map((c) => ({
              value: String(c.id),
              label: asCaption(c.customer_name || c.name) || String(c.id),
            }))}
            value={customerId}
            onChange={setCustomerId}
            placeholder="Select customer"
          />
        </FormRow>
        <FormRow label="Order date">
          <TextInput type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </FormRow>
        <FormRow label="Expected date">
          <TextInput
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </FormRow>
      </div>
      <FormRow label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <FormRow label="Commission agents">
          <div style={{ display: 'grid', gap: 4, maxHeight: 100, overflow: 'auto' }}>
            {agents.map((a) => {
              const aid = String(a.id);
              return (
                <label key={aid} style={{ display: 'flex', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={commissionIds.includes(aid)}
                    onChange={() => setCommissionIds((p) => toggleId(p, aid))}
                  />
                  {asCaption(a.name || a.agent_name) || aid}
                </label>
              );
            })}
          </div>
        </FormRow>
        <FormRow label="Sales reps">
          <div style={{ display: 'grid', gap: 4, maxHeight: 100, overflow: 'auto' }}>
            {(workers.length ? workers : agents).map((w) => {
              const wid = String(w.id);
              return (
                <label key={wid} style={{ display: 'flex', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={salesRepIds.includes(wid)}
                    onChange={() => setSalesRepIds((p) => toggleId(p, wid))}
                  />
                  {asCaption(w.name || w.worker_name) || wid}
                </label>
              );
            })}
          </div>
        </FormRow>
      </div>
    </DocumentEditor>
  );
}

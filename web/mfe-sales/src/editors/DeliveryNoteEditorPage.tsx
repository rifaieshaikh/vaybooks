import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { EditorLineItem, ReceiveSourceLine } from '@vaybooks/ui-kit';
import {
  DocumentEditor,
  FormRow,
  LineItemsGrid,
  MoneySummary,
  ReceiveGrid,
  SearchableSelect,
  Select,
  TextArea,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreateDeliveryNoteMutation,
  useGetBusinessProfileQuery,
  useGetCustomerQuery,
  useGetDeliveryNoteQuery,
  useGetSalesInvoiceQuery,
  useGetSalesOrderQuery,
  useListCustomersQuery,
  useListDeliveryPartnersQuery,
  useListInventoryProductsQuery,
  useListSalesInvoicesQuery,
  useListSalesOrdersQuery,
  useUpdateDeliveryNoteMutation,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import {
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

type DnReceiveLine = ReceiveSourceLine & {
  productId: string;
};

function sourceLinesToReceive(raw: unknown): DnReceiveLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      const row = item as Record<string, unknown>;
      const productId = String(row.product_id || row.item_id || '');
      const ordered = Number(
        row.qty_ordered ?? row.qty ?? row.qty_delivered ?? row.remaining_qty ?? 0,
      );
      const delivered = Number(row.qty_delivered ?? 0);
      const remaining = Math.max(ordered - delivered, 0);
      const qty = remaining > 0 ? remaining : ordered;
      if (!productId || qty <= 0) return null;
      return {
        id: String(row.id || `${productId}-${i}`),
        productId,
        productLabel:
          asCaption(row.item_name || row.product_name || row.description) || productId,
        orderedQty: ordered || qty,
        receivedQty: qty,
        rate: Number(row.rate || 0),
      } satisfies DnReceiveLine;
    })
    .filter(Boolean) as DnReceiveLine[];
}

function receiveToEditorLines(rows: DnReceiveLine[]): EditorLineItem[] {
  return rows
    .filter((r) => r.productId && Number(r.receivedQty) > 0)
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      qty: Number(r.receivedQty) || 0,
      rate: Number(r.rate) || 0,
      discountInput: 0,
      discountMode: 'flat' as const,
      discount: 0,
      hsn: '',
      taxable: 0,
      gstRate: 0,
      tax: 0,
      total: 0,
    }));
}

export function DeliveryNoteEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading } = useGetDeliveryNoteQuery(editId, { skip: !editId });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: orders = [] } = useListSalesOrdersQuery();
  const { data: invoices = [] } = useListSalesInvoicesQuery();
  const { data: partners = [] } = useListDeliveryPartnersQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();
  const [createDn, createState] = useCreateDeliveryNoteMutation();
  const [updateDn, updateState] = useUpdateDeliveryNoteMutation();

  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [existingLocationId, setExistingLocationId] = useState('');
  const [salesOrderId, setSalesOrderId] = useState(
    () => params.get('sales_order_id') || params.get('reference_so_id') || '',
  );
  const [salesInvoiceId, setSalesInvoiceId] = useState(
    () => params.get('sales_invoice_id') || params.get('reference_invoice_id') || '',
  );
  const [partnerId, setPartnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [receiveLines, setReceiveLines] = useState<DnReceiveLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);

  const { data: customerDetail } = useGetCustomerQuery(customerId, { skip: !customerId });
  const { data: soDetail } = useGetSalesOrderQuery(salesOrderId, {
    skip: !salesOrderId || isEdit,
  });
  const { data: invDetail } = useGetSalesInvoiceQuery(salesInvoiceId, {
    skip: !salesInvoiceId || isEdit || Boolean(salesOrderId),
  });

  const useReceive = Boolean(salesOrderId || salesInvoiceId) && !isEdit;
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const gstCtx = useMemo(
    () => ({
      businessRegistered: Boolean(business?.gstin) || business?.gst_registered === true,
      businessStateCode: String(business?.state_code ?? '') || undefined,
      customerStateCode: String(customerDetail?.state_code ?? '') || undefined,
    }),
    [business, customerDetail],
  );

  const workingLines = useMemo(
    () => (useReceive ? receiveToEditorLines(receiveLines) : lines),
    [useReceive, receiveLines, lines],
  );
  const { lines: previewLines, summary } = useMemo(
    () => recomputeSalesLines(workingLines, gstCtx),
    [workingLines, gstCtx],
  );

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setCustomerId(String(existing.customer_id || params.get('customer_id') || ''));
    setDeliveryDate(String(existing.delivery_date || todayISO()).slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setSalesOrderId(String(existing.sales_order_id || ''));
    setSalesInvoiceId(String(existing.sales_invoice_id || ''));
    setPartnerId(String(existing.delivery_partner_id || ''));
    setNotes(String(existing.notes || ''));
    setLines(mapApiLinesToEditor(existing.lines));
    setHydrated(true);
  }, [existing, isEdit, hydrated, params]);

  useEffect(() => {
    if (isEdit || !salesOrderId || !soDetail) return;
    if (!customerId && soDetail.customer_id) setCustomerId(String(soDetail.customer_id));
    setReceiveLines(sourceLinesToReceive(soDetail.lines));
    setSalesInvoiceId('');
  }, [salesOrderId, soDetail, isEdit, customerId]);

  useEffect(() => {
    if (isEdit || salesOrderId || !salesInvoiceId || !invDetail) return;
    if (!customerId && invDetail.customer_id) setCustomerId(String(invDetail.customer_id));
    setReceiveLines(sourceLinesToReceive(invDetail.lines || invDetail.items));
  }, [salesInvoiceId, invDetail, isEdit, salesOrderId, customerId]);

  function onProductSelected(index: number, productId: string) {
    const product = productOptions.find((p) => p.id === productId);
    setLines((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        productId,
        rate: product?.rate ?? next[index].rate,
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
        setError(
          useReceive
            ? 'Enter delivered qty on at least one source line.'
            : 'Add at least one product line.',
        );
        return;
      }
      const body: Record<string, unknown> = {
        customer_id: customerId,
        delivery_date: deliveryDate || undefined,
        sales_order_id: salesOrderId || undefined,
        sales_invoice_id: salesInvoiceId || undefined,
        notes,
        location_id: locationId,
        delivery_partner_id: partnerId,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updateDn({ id: editId, body }).unwrap();
        navigate(`/sales/delivery-notes/${saved.id || editId}`);
      } else {
        const created = await createDn(body).unwrap();
        navigate(`/sales/delivery-notes/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && isLoading) return <p>Loading delivery note…</p>;

  return (
    <DocumentEditor
      title={isEdit ? 'Edit delivery note' : 'New delivery note'}
      onCancel={() =>
        navigate(isEdit ? `/sales/delivery-notes/${editId}` : '/sales/delivery-notes')
      }
      onSave={onSave}
      saving={createState.isLoading || updateState.isLoading}
      error={error}
      saveLabel={isEdit ? 'Update DN' : 'Create DN'}
      body={
        useReceive ? (
          <ReceiveGrid
            lines={receiveLines}
            orderedLabel="Ordered"
            receivedLabel="Deliver"
            onChange={(next) => setReceiveLines(next as DnReceiveLine[])}
          />
        ) : (
          <LineItemsGrid
            lines={previewLines}
            products={productOptions}
            showDiscount={false}
            onChange={setLines}
            onProductSelected={onProductSelected}
          />
        )
      }
      footer={
        <MoneySummary
          items={[
            { label: 'Taxable', value: summary.taxable },
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
        <FormRow label="Delivery date">
          <TextInput
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Sales order">
          <Select
            value={salesOrderId}
            onChange={(e) => {
              setSalesOrderId(e.target.value);
              if (e.target.value) setSalesInvoiceId('');
            }}
            disabled={isEdit}
          >
            <option value="">None (manual lines)</option>
            {orders.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {asCaption(o.so_number) || String(o.id)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Invoice ref">
          <Select
            value={salesInvoiceId}
            onChange={(e) => {
              setSalesInvoiceId(e.target.value);
              if (e.target.value) setSalesOrderId('');
            }}
            disabled={isEdit || Boolean(salesOrderId)}
          >
            <option value="">None</option>
            {invoices.map((inv) => (
              <option key={String(inv.id)} value={String(inv.id)}>
                {asCaption(inv.store_invoice_number || inv.voucher_number) || String(inv.id)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Delivery partner">
          <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">None</option>
            {partners.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {asCaption(p.name || p.partner_name) || String(p.id)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Notes">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormRow>
      </div>
    </DocumentEditor>
  );
}

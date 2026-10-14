import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { EditorLineItem } from '@vaybooks/ui-kit';
import {
  DocumentEditor,
  FormRow,
  LineItemsGrid,
  MoneySummary,
  SearchableSelect,
  Select,
  TextArea,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreateSalesReturnMutation,
  useGetBusinessProfileQuery,
  useGetCustomerQuery,
  useGetSalesReturnQuery,
  useListCustomersQuery,
  useListInventorySkusQuery,
  useListSalesInvoicesQuery,
  useUpdateSalesReturnMutation,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import { LIST_FETCH_ALL_SIZE, pagedItems } from '../pages/salesListHelpers';
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

export function ReturnEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading } = useGetSalesReturnQuery(editId, { skip: !editId });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventorySkusQuery();
  const { data: invoicesPage } = useListSalesInvoicesQuery({
    page: 1,
    page_size: LIST_FETCH_ALL_SIZE,
  });
  const invoices = pagedItems(invoicesPage);
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();
  const [createReturn, createState] = useCreateSalesReturnMutation();
  const [updateReturn, updateState] = useUpdateSalesReturnMutation();

  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [returnDate, setReturnDate] = useState(todayISO());
  const [existingLocationId, setExistingLocationId] = useState('');
  const [sourceInvoiceId, setSourceInvoiceId] = useState(
    () => params.get('source_invoice_id') || '',
  );
  const [restock, setRestock] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);

  const { data: customerDetail } = useGetCustomerQuery(customerId, { skip: !customerId });
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
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
    setReturnDate(String(existing.return_date || todayISO()).slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setSourceInvoiceId(String(existing.source_invoice_id || ''));
    setRestock(existing.restock_items !== false);
    setNotes(String(existing.notes || existing.return_reason || ''));
    setLines(mapApiLinesToEditor(existing.lines));
    setHydrated(true);
  }, [existing, isEdit, hydrated, params]);

  useEffect(() => {
    if (isEdit || !sourceInvoiceId) return;
    const inv = invoices.find((i) => String(i.id) === sourceInvoiceId);
    if (inv?.customer_id && !customerId) setCustomerId(String(inv.customer_id));
  }, [sourceInvoiceId, invoices, isEdit, customerId]);

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
      const payloadLines = editorLinesToPayload(previewLines, locationId).map((l) => ({
        product_id: l.product_id,
        sku_id: l.sku_id,
        qty: l.qty,
        rate: l.rate,
      }));
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      const body: Record<string, unknown> = {
        customer_id: customerId,
        return_date: returnDate || undefined,
        source_invoice_id: sourceInvoiceId || undefined,
        notes,
        location_id: locationId,
        restock_items: restock,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updateReturn({ id: editId, body }).unwrap();
        navigate(`/sales/returns/${saved.id || editId}`);
      } else {
        const created = await createReturn(body).unwrap();
        navigate(`/sales/returns/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && isLoading) return <p>Loading return…</p>;

  return (
    <DocumentEditor
      title={isEdit ? 'Edit sales return' : 'New sales return'}
      onCancel={() => navigate(isEdit ? `/sales/returns/${editId}` : '/sales/returns')}
      onSave={onSave}
      saving={createState.isLoading || updateState.isLoading}
      error={error}
      saveLabel={isEdit ? 'Update return' : 'Create return'}
      body={
        <LineItemsGrid
          lines={previewLines}
          products={productOptions}
          showDiscount={false}
          onChange={setLines}
          onProductSelected={onProductSelected}
        />
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
        <FormRow label="Return date">
          <TextInput
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Source invoice">
          <Select value={sourceInvoiceId} onChange={(e) => setSourceInvoiceId(e.target.value)}>
            <option value="">None</option>
            {invoices.map((inv) => (
              <option key={String(inv.id)} value={String(inv.id)}>
                {asCaption(inv.store_invoice_number || inv.voucher_number) || String(inv.id)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Restock items">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
            />
            Return to stock
          </label>
        </FormRow>
      </div>
      <FormRow label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </DocumentEditor>
  );
}

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
  useCreatePurchaseOrderMutation,
  useGetBusinessProfileQuery,
  useGetPurchaseOrderQuery,
  useGetVendorQuery,
  useLazyGetVendorPurchaseRateQuery,
  useListInventoryProductsQuery,
  useListVendorsQuery,
  useUpdatePurchaseOrderMutation,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import {
  editorLinesToPoPayload,
  mapApiLinesToEditor,
  mapProductsToLineOptions,
  recomputePurchaseLines,
  todayISO,
} from './linePreview';
import {
  resolveDocLocationId,
  useWorkingLocation,
} from './useWorkingLocation';

export function PurchaseOrderEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading } = useGetPurchaseOrderQuery(editId, { skip: !editId });
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();
  const [createPo, createState] = useCreatePurchaseOrderMutation();
  const [updatePo, updateState] = useUpdatePurchaseOrderMutation();
  const [fetchVendorRate] = useLazyGetVendorPurchaseRateQuery();

  const [vendorId, setVendorId] = useState(() => params.get('vendor_id') || '');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState('');
  const [existingLocationId, setExistingLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);

  const { data: vendorDetail } = useGetVendorQuery(vendorId, { skip: !vendorId });
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const gstCtx = useMemo(
    () => ({
      vendorRegistered: Boolean(vendorDetail?.gstin),
      businessStateCode: String(business?.state_code ?? '') || undefined,
      vendorStateCode: String(vendorDetail?.state_code ?? '') || undefined,
    }),
    [business, vendorDetail],
  );
  const { lines: previewLines, summary } = useMemo(
    () => recomputePurchaseLines(lines, gstCtx),
    [lines, gstCtx],
  );

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setVendorId(String(existing.vendor_id || params.get('vendor_id') || ''));
    setOrderDate(String(existing.order_date || todayISO()).slice(0, 10));
    setExpectedDate(String(existing.expected_date || '').slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setNotes(String(existing.notes || ''));
    setLines(mapApiLinesToEditor(existing.lines));
    setHydrated(true);
  }, [existing, isEdit, hydrated, params]);

  async function onProductSelected(index: number, productId: string) {
    const product = productOptions.find((p) => p.id === productId);
    let rate = product?.rate ?? 0;
    if (vendorId && productId) {
      try {
        const res = await fetchVendorRate({
          vendor_id: vendorId,
          product_id: productId,
        }).unwrap();
        if (res && Number.isFinite(Number(res.rate))) rate = Number(res.rate);
      } catch {
        /* use product fallback */
      }
    }
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
      if (!vendorId) {
        setError('Select a vendor.');
        return;
      }
      if (!isEdit && !locationId) {
        setError('Set a working location before saving.');
        return;
      }
      const payloadLines = editorLinesToPoPayload(previewLines);
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      const body: Record<string, unknown> = {
        vendor_id: vendorId,
        order_date: orderDate || undefined,
        expected_date: expectedDate || undefined,
        notes,
        location_id: locationId,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updatePo({ id: editId, body }).unwrap();
        navigate(`/purchases/orders/${saved.id || editId}`);
      } else {
        const created = await createPo(body).unwrap();
        navigate(`/purchases/orders/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && isLoading) return <p>Loading purchase order…</p>;

  return (
    <DocumentEditor
      title={isEdit ? 'Edit purchase order' : 'New purchase order'}
      onCancel={() => navigate(isEdit ? `/purchases/orders/${editId}` : '/purchases/orders')}
      onSave={onSave}
      saving={createState.isLoading || updateState.isLoading}
      error={error}
      saveLabel={isEdit ? 'Update PO' : 'Create PO'}
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
        <FormRow label="Vendor *">
          <SearchableSelect
            options={vendors.map((v) => ({
              value: String(v.id),
              label: asCaption(v.vendor_name || v.name) || String(v.id),
            }))}
            value={vendorId}
            onChange={setVendorId}
            placeholder="Select vendor"
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
    </DocumentEditor>
  );
}

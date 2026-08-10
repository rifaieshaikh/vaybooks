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
  useCreateSalesEstimateMutation,
  useCreateSalesQuotationMutation,
  useGetBusinessProfileQuery,
  useGetCustomerQuery,
  useGetSalesEstimateQuery,
  useGetSalesQuotationQuery,
  useListCustomerPricesQuery,
  useListCustomersQuery,
  useListInventoryProductsQuery,
  useUpdateSalesEstimateMutation,
  useUpdateSalesQuotationMutation,
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

export type PricedDocMode = 'estimate' | 'quotation';

export function PricedDocEditorPage({ mode }: { mode: PricedDocMode }) {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);
  const basePath = mode === 'estimate' ? '/sales/estimates' : '/sales/quotations';
  const titleNoun = mode === 'estimate' ? 'estimate' : 'quotation';

  const estimateQ = useGetSalesEstimateQuery(editId, { skip: !editId || mode !== 'estimate' });
  const quotationQ = useGetSalesQuotationQuery(editId, {
    skip: !editId || mode !== 'quotation',
  });
  const existing = mode === 'estimate' ? estimateQ.data : quotationQ.data;
  const loading = mode === 'estimate' ? estimateQ.isLoading : quotationQ.isLoading;

  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();

  const [createEstimate, createEstState] = useCreateSalesEstimateMutation();
  const [updateEstimate, updateEstState] = useUpdateSalesEstimateMutation();
  const [createQuotation, createQuoState] = useCreateSalesQuotationMutation();
  const [updateQuotation, updateQuoState] = useUpdateSalesQuotationMutation();

  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [documentDate, setDocumentDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState('');
  const [existingLocationId, setExistingLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
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
    setDocumentDate(
      String(existing.document_date || existing.created_at || todayISO()).slice(0, 10),
    );
    setValidUntil(String(existing.valid_until || '').slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setNotes(String(existing.notes || ''));
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
        discountInput: 0,
        discountMode: 'flat',
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
        ...l,
        discount: 0,
        discount_input: 0,
        discount_mode: 'flat',
      }));
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      const body: Record<string, unknown> = {
        customer_id: customerId,
        document_date: documentDate || undefined,
        valid_until: validUntil || undefined,
        notes,
        location_id: locationId,
        lines: payloadLines,
      };
      if (mode === 'estimate') {
        if (isEdit) {
          const saved = await updateEstimate({ id: editId, body }).unwrap();
          navigate(`${basePath}/${saved.id || editId}`);
        } else {
          const created = await createEstimate(body).unwrap();
          navigate(`${basePath}/${created.id}`);
        }
      } else if (isEdit) {
        const saved = await updateQuotation({ id: editId, body }).unwrap();
        navigate(`${basePath}/${saved.id || editId}`);
      } else {
        const created = await createQuotation(body).unwrap();
        navigate(`${basePath}/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && loading) return <p>Loading {titleNoun}…</p>;

  const saving =
    createEstState.isLoading ||
    updateEstState.isLoading ||
    createQuoState.isLoading ||
    updateQuoState.isLoading;

  return (
    <DocumentEditor
      title={isEdit ? `Edit ${titleNoun}` : `New ${titleNoun}`}
      onCancel={() => navigate(isEdit ? `${basePath}/${editId}` : basePath)}
      onSave={onSave}
      saving={saving}
      error={error}
      saveLabel={isEdit ? `Update ${titleNoun}` : `Create ${titleNoun}`}
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
        <FormRow label="Document date">
          <TextInput
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Valid until">
          <TextInput
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </FormRow>
      </div>
      <FormRow label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </DocumentEditor>
  );
}

export function EstimateEditorPage() {
  return <PricedDocEditorPage mode="estimate" />;
}

export function QuotationEditorPage() {
  return <PricedDocEditorPage mode="quotation" />;
}

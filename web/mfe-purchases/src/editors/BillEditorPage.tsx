import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { EditorLineItem } from '@vaybooks/ui-kit';
import {
  DocumentEditor,
  ErrorText,
  FormRow,
  LineItemsGrid,
  MoneySummary,
  SearchableSelect,
  Select,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreatePurchaseBillMutation,
  useGetBusinessProfileQuery,
  useGetPurchaseBillQuery,
  useGetVendorQuery,
  useLazyGetVendorPurchaseRateQuery,
  useListFinanceAccountsQuery,
  useListInventoryProductsQuery,
  useListVendorServicesQuery,
  useListVendorsQuery,
  useUpdatePurchaseBillMutation,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import {
  canEditInvoiceMonth,
  editorLinesToBillPayload,
  mapApiLinesToEditor,
  mapProductsToLineOptions,
  mapServicesToLineOptions,
  recomputePurchaseLines,
  todayISO,
} from './linePreview';
import {
  resolveDocLocationId,
  useWorkingLocation,
} from './useWorkingLocation';

function isCashOrBank(account: Record<string, unknown>): boolean {
  const t = String(account.account_type || account.type || '').toLowerCase();
  const name = String(account.account_name || account.name || '').toLowerCase();
  return (
    t.includes('cash') ||
    t.includes('bank') ||
    name.includes('cash') ||
    name.includes('bank') ||
    account.is_cash_account === true ||
    account.is_bank_account === true
  );
}

export function BillEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading } = useGetPurchaseBillQuery(editId, { skip: !editId });
  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: services = [] } = useListVendorServicesQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();
  const [createBill, createState] = useCreatePurchaseBillMutation();
  const [updateBill, updateState] = useUpdatePurchaseBillMutation();
  const [fetchVendorRate] = useLazyGetVendorPurchaseRateQuery();

  const [vendorId, setVendorId] = useState(() => params.get('vendor_id') || '');
  const [billNumber, setBillNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [existingLocationId, setExistingLocationId] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [payingAccountId, setPayingAccountId] = useState('');
  const [referenceGrn, setReferenceGrn] = useState(() => params.get('reference_grn_id') || '');
  const [applyStock, setApplyStock] = useState(() => !params.get('reference_grn_id'));
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);

  const { data: vendorDetail } = useGetVendorQuery(vendorId, { skip: !vendorId });
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const serviceOptions = useMemo(() => mapServicesToLineOptions(services), [services]);
  const payAccounts = useMemo(() => accounts.filter(isCashOrBank), [accounts]);

  const gstCtx = useMemo(() => {
    const vendorRegistered =
      Boolean(vendorDetail?.gstin) ||
      String(vendorDetail?.registration_type || '').toLowerCase().includes('regular');
    return {
      vendorRegistered,
      businessStateCode: String(business?.state_code ?? '') || undefined,
      vendorStateCode: String(vendorDetail?.state_code ?? '') || undefined,
    };
  }, [business, vendorDetail]);

  const { lines: previewLines, summary } = useMemo(
    () => recomputePurchaseLines(lines, gstCtx),
    [lines, gstCtx],
  );

  const monthEditable = canEditInvoiceMonth(voucherDate);
  const hasGrnRef = Boolean(referenceGrn || existing?.reference_grn_id);

  useEffect(() => {
    if (hasGrnRef) setApplyStock(false);
  }, [hasGrnRef]);

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setVendorId(String(existing.vendor_id || params.get('vendor_id') || ''));
    setBillNumber(String(existing.vendor_bill_number || ''));
    const billDate = String(existing.bill_date || existing.voucher_date || todayISO()).slice(0, 10);
    setVoucherDate(billDate);
    setDueDate(String(existing.due_date || billDate).slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setAmountPaid(String(existing.amount_paid ?? 0));
    setPayingAccountId(String(existing.paying_account_id || ''));
    setReferenceGrn(String(existing.reference_grn_id || ''));
    setApplyStock(Boolean(existing.apply_stock) && !existing.reference_grn_id);
    setLines(mapApiLinesToEditor(existing.lines || existing.items));
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
        // fall back to last_purchase_rate on product option
      }
    }
    setLines((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        itemType: 'product',
        productId,
        serviceId: '',
        rate,
        hsn: product?.hsn || '',
        gstRate: product?.gstRate ?? 0,
      };
      return next;
    });
  }

  function onServiceSelected(index: number, serviceId: string) {
    const service = serviceOptions.find((s) => s.id === serviceId);
    setLines((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        itemType: 'service',
        serviceId,
        productId: '',
        rate: service?.rate ?? 0,
        hsn: service?.hsn || '',
        gstRate: service?.gstRate ?? 0,
      };
      return next;
    });
  }

  async function onSave() {
    setError(null);
    if (isEdit && !monthEditable) {
      setError('Bills can only be edited in the same calendar month.');
      return;
    }
    try {
      if (!vendorId) {
        setError('Select a vendor.');
        return;
      }
      if (!billNumber.trim()) {
        setError('Vendor bill number is required.');
        return;
      }
      if (!isEdit && !locationId) {
        setError('Set a working location before saving.');
        return;
      }
      const payloadLines = editorLinesToBillPayload(previewLines);
      if (!payloadLines.length) {
        setError('Add at least one product or service line.');
        return;
      }
      const body: Record<string, unknown> = {
        vendor_id: vendorId,
        vendor_bill_number: billNumber.trim(),
        voucher_date: voucherDate || undefined,
        due_date: dueDate || voucherDate || undefined,
        amount_paid: Number(amountPaid) || 0,
        paying_account_id: payingAccountId || undefined,
        apply_stock: hasGrnRef ? false : applyStock,
        location_id: locationId,
        reference_grn_id: referenceGrn || undefined,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updateBill({ id: editId, body }).unwrap();
        navigate(`/purchases/bills/${saved.id || editId}`);
      } else {
        const created = await createBill(body).unwrap();
        navigate(`/purchases/bills/${created.id}`);
      }
    } catch (e) {
      setError(extractError(e));
    }
  }

  if (isEdit && isLoading) return <p>Loading bill…</p>;

  return (
    <DocumentEditor
      title={isEdit ? 'Edit purchase bill' : 'New purchase bill'}
      onCancel={() => navigate(isEdit ? `/purchases/bills/${editId}` : '/purchases/bills')}
      onSave={onSave}
      saving={createState.isLoading || updateState.isLoading}
      error={error}
      saveLabel={isEdit ? 'Update bill' : 'Create bill'}
      body={
        <div style={{ display: 'grid', gap: 12 }}>
          {isEdit && !monthEditable ? (
            <ErrorText>This bill is outside the current month and cannot be saved.</ErrorText>
          ) : null}
          <LineItemsGrid
            lines={previewLines}
            products={productOptions}
            services={serviceOptions}
            allowServices
            showDiscount={false}
            disabled={isEdit && !monthEditable}
            onChange={setLines}
            onProductSelected={onProductSelected}
            onServiceSelected={onServiceSelected}
          />
        </div>
      }
      footer={
        <div style={{ display: 'grid', gap: 10, minWidth: 260 }}>
          <MoneySummary
            items={[
              { label: 'Taxable', value: summary.taxable },
              { label: 'Tax', value: summary.total_tax },
              { label: 'Grand total', value: summary.grand_total },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormRow label="Amount paid">
              <TextInput
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                disabled={isEdit && !monthEditable}
              />
            </FormRow>
            <FormRow label="Paying account">
              <Select
                value={payingAccountId}
                onChange={(e) => setPayingAccountId(e.target.value)}
                disabled={isEdit && !monthEditable}
              >
                <option value="">None</option>
                {payAccounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {asCaption(a.account_name || a.name)}
                  </option>
                ))}
              </Select>
            </FormRow>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={applyStock && !hasGrnRef}
              disabled={hasGrnRef || (isEdit && !monthEditable)}
              onChange={(e) => setApplyStock(e.target.checked)}
            />
            Apply stock{hasGrnRef ? ' (disabled — GRN linked)' : ''}
          </label>
        </div>
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
            disabled={isEdit && !monthEditable}
          />
        </FormRow>
        <FormRow label="Bill # *">
          <TextInput
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            disabled={isEdit && !monthEditable}
          />
        </FormRow>
        <FormRow label="Date *">
          <TextInput
            type="date"
            value={voucherDate}
            onChange={(e) => {
              const next = e.target.value;
              setVoucherDate(next);
              if (!isEdit && (!dueDate || dueDate === voucherDate)) {
                setDueDate(next);
              }
            }}
            disabled={isEdit && !monthEditable}
          />
        </FormRow>
        <FormRow label="Due date">
          <TextInput
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={isEdit && !monthEditable}
          />
        </FormRow>
      </div>
    </DocumentEditor>
  );
}

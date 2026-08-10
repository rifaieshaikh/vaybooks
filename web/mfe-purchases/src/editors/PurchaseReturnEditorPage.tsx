import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  useCreatePurchaseReturnMutation,
  useGetBusinessProfileQuery,
  useGetVendorQuery,
  useListFinanceAccountsQuery,
  useListInventoryProductsQuery,
  useListPurchaseBillsQuery,
  useListVendorsQuery,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import {
  editorLinesToReturnPayload,
  mapProductsToLineOptions,
  recomputePurchaseLines,
  todayISO,
} from './linePreview';
import { useWorkingLocation } from './useWorkingLocation';

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

export function PurchaseReturnEditorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: bills = [] } = useListPurchaseBillsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId } = useWorkingLocation();
  const [createReturn, createState] = useCreatePurchaseReturnMutation();

  const [vendorId, setVendorId] = useState(() => params.get('vendor_id') || '');
  const [returnDate, setReturnDate] = useState(todayISO());
  const [sourceBillId, setSourceBillId] = useState(() => params.get('source_bill_id') || '');
  const [amountRefunded, setAmountRefunded] = useState('0');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: vendorDetail } = useGetVendorQuery(vendorId, { skip: !vendorId });
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const payAccounts = useMemo(() => accounts.filter(isCashOrBank), [accounts]);
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
    if (!sourceBillId) return;
    const bill = bills.find((b) => String(b.id) === sourceBillId);
    if (bill?.vendor_id && !vendorId) setVendorId(String(bill.vendor_id));
  }, [sourceBillId, bills, vendorId]);

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
      if (!vendorId) {
        setError('Select a vendor.');
        return;
      }
      if (!locationId) {
        setError('Set a working location before saving.');
        return;
      }
      const payloadLines = editorLinesToReturnPayload(previewLines);
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      const created = await createReturn({
        vendor_id: vendorId,
        return_date: returnDate || undefined,
        source_bill_id: sourceBillId || undefined,
        amount_refunded: Number(amountRefunded) || 0,
        refund_account_id: refundAccountId || undefined,
        notes,
        location_id: locationId,
        lines: payloadLines,
      }).unwrap();
      navigate(`/purchases/returns/${created.id}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <DocumentEditor
      title="New purchase return"
      onCancel={() => navigate('/purchases/returns')}
      onSave={onSave}
      saving={createState.isLoading}
      error={error}
      saveLabel="Create return"
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
        <div style={{ display: 'grid', gap: 10, minWidth: 260 }}>
          <MoneySummary
            items={[
              { label: 'Taxable', value: summary.taxable },
              { label: 'Total', value: summary.grand_total },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormRow label="Refund amount">
              <TextInput
                value={amountRefunded}
                onChange={(e) => setAmountRefunded(e.target.value)}
              />
            </FormRow>
            <FormRow label="Refund account">
              <Select
                value={refundAccountId}
                onChange={(e) => setRefundAccountId(e.target.value)}
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
          />
        </FormRow>
        <FormRow label="Return date">
          <TextInput
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Source bill">
          <Select value={sourceBillId} onChange={(e) => setSourceBillId(e.target.value)}>
            <option value="">None</option>
            {bills.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {asCaption(b.vendor_bill_number || b.voucher_number) || String(b.id)}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>
      <FormRow label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </DocumentEditor>
  );
}

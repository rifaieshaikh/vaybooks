import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DiscountMode, EditorLineItem } from '@vaybooks/ui-kit';
import {
  Button,
  DiscountInput,
  DocumentEditor,
  ErrorText,
  FormRow,
  LineItemsGrid,
  MoneySummary,
  SearchableSelect,
  Select,
  TextArea,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreateCustomerMutation,
  useCreateSalesInvoiceMutation,
  useGetBusinessProfileQuery,
  useGetCustomerQuery,
  useGetCustomerSummaryQuery,
  useGetSalesInvoiceQuery,
  useListCommissionAgentsQuery,
  useListCustomerPricesQuery,
  useListCustomersQuery,
  useListDiscountRulesQuery,
  useListFinanceAccountsQuery,
  useListInventoryProductsQuery,
  useListWorkersQuery,
  useUpdateSalesInvoiceMutation,
} from '@vaybooks/store';
import { asCaption, extractError, formatMoney } from '../utils';
import {
  applyDiscountRulesToLines,
  buildCustomerPriceMap,
  canEditInvoiceMonth,
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

export function InvoiceEditorPage() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = routeId && routeId !== 'new' ? routeId : '';
  const isEdit = Boolean(editId);

  const { data: existing, isLoading: loadingExisting } = useGetSalesInvoiceQuery(editId, {
    skip: !editId,
  });
  const { data: customers = [] } = useListCustomersQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: accounts = [] } = useListFinanceAccountsQuery();
  const { data: business } = useGetBusinessProfileQuery();
  const { locationId: workingLocationId } = useWorkingLocation();
  const { data: agents = [] } = useListCommissionAgentsQuery();
  const { data: workers = [] } = useListWorkersQuery({ active_only: true });
  const { data: discountRules = [] } = useListDiscountRulesQuery({ active_only: true });

  const [createInv, createState] = useCreateSalesInvoiceMutation();
  const [updateInv, updateState] = useUpdateSalesInvoiceMutation();
  const [createCustomer, createCustState] = useCreateCustomerMutation();

  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [walkInName, setWalkInName] = useState('');
  const [walkInMobile, setWalkInMobile] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [existingLocationId, setExistingLocationId] = useState('');
  const [storeAccountId, setStoreAccountId] = useState('');
  const locationId = resolveDocLocationId(isEdit, workingLocationId, existingLocationId);
  const [lines, setLines] = useState<EditorLineItem[]>([]);
  const [invoiceDiscountInput, setInvoiceDiscountInput] = useState(0);
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<DiscountMode>('flat');
  const [creditApplied, setCreditApplied] = useState('0');
  const [advanceApplied, setAdvanceApplied] = useState('0');
  const [amountReceived, setAmountReceived] = useState('0');
  const [commissionIds, setCommissionIds] = useState<string[]>([]);
  const [salesRepIds, setSalesRepIds] = useState<string[]>([]);
  const [terms, setTerms] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);

  const { data: customerDetail } = useGetCustomerQuery(customerId, { skip: !customerId });
  const { data: customerSummary } = useGetCustomerSummaryQuery(customerId, { skip: !customerId });
  const { data: customerPrices = [] } = useListCustomerPricesQuery(
    customerId ? { customer_id: customerId } : undefined,
    { skip: !customerId },
  );

  const storeAccounts = useMemo(
    () => accounts.filter((a) => a.is_store_account === true),
    [accounts],
  );
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const priceMap = useMemo(() => buildCustomerPriceMap(customerPrices), [customerPrices]);

  const bankAccounts = useMemo(() => {
    const raw = business?.bank_accounts;
    if (!Array.isArray(raw)) return [] as Record<string, unknown>[];
    return raw as Record<string, unknown>[];
  }, [business]);

  const customFieldDefs = useMemo(() => {
    const templates = business?.document_templates as
      | Record<string, { custom_fields?: Record<string, unknown>[] }>
      | undefined;
    const fields = templates?.sales_invoice?.custom_fields;
    if (!Array.isArray(fields)) return [] as { key: string; label: string; required?: boolean }[];
    return fields
      .map((f) => ({
        key: String(f.key || ''),
        label: String(f.label || f.key || ''),
        required: Boolean(f.required),
      }))
      .filter((f) => f.key);
  }, [business]);

  const gstCtx = useMemo(() => {
    const registered =
      Boolean(business?.gstin) ||
      String(business?.registration_type || '').toLowerCase().includes('regular') ||
      business?.gst_registered === true;
    return {
      businessRegistered: registered,
      businessStateCode: String(business?.state_code ?? business?.state ?? '') || undefined,
      customerStateCode:
        String(customerDetail?.state_code ?? customerDetail?.state ?? '') || undefined,
    };
  }, [business, customerDetail]);

  const { lines: previewLines, summary, invoiceDiscountAmount } = useMemo(
    () =>
      recomputeSalesLines(lines, gstCtx, {
        input: invoiceDiscountInput,
        mode: invoiceDiscountMode,
      }),
    [lines, gstCtx, invoiceDiscountInput, invoiceDiscountMode],
  );

  const monthEditable = canEditInvoiceMonth(voucherDate);
  const saving = createState.isLoading || updateState.isLoading || createCustState.isLoading;

  useEffect(() => {
    if (!storeAccountId && storeAccounts[0]) {
      setStoreAccountId(String(storeAccounts[0].id));
    }
  }, [storeAccounts, storeAccountId]);

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setCustomerId(String(existing.customer_id || params.get('customer_id') || ''));
    setInvoiceNumber(String(existing.store_invoice_number || ''));
    const d = String(existing.sale_date || existing.voucher_date || todayISO()).slice(0, 10);
    setVoucherDate(d);
    setDueDate(String(existing.due_date || d).slice(0, 10));
    setExistingLocationId(String(existing.location_id || ''));
    setStoreAccountId(String(existing.store_account_id || storeAccountId || ''));
    setInvoiceDiscountInput(Number(existing.invoice_discount ?? existing.discount ?? 0) || 0);
    setInvoiceDiscountMode(
      String(existing.invoice_discount_mode || 'flat').toLowerCase() === 'percent'
        ? 'percent'
        : 'flat',
    );
    setCreditApplied(String(existing.credit_applied ?? 0));
    setAdvanceApplied(String(existing.advance_applied ?? 0));
    setAmountReceived(String(existing.amount_received ?? existing.collected ?? 0));
    setTerms(String(existing.terms_and_conditions || existing.terms || ''));
    setBankAccountId(String(existing.bank_account_id || ''));
    const agentsRaw = existing.commission_agent_ids;
    const repsRaw = existing.sales_rep_ids;
    setCommissionIds(Array.isArray(agentsRaw) ? agentsRaw.map(String) : []);
    setSalesRepIds(Array.isArray(repsRaw) ? repsRaw.map(String) : []);
    setLines(mapApiLinesToEditor(existing.lines || existing.items));
    setHydrated(true);
  }, [existing, isEdit, hydrated, params, storeAccountId]);

  const creditBal = Number(customerSummary?.credit_balance ?? 0) || 0;
  const advanceBal = Number(customerSummary?.advance ?? 0) || 0;

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

  function reapplyDiscounts() {
    setLines((prev) => applyDiscountRulesToLines(prev, discountRules, customerId || undefined));
  }

  async function resolveCustomerId(): Promise<string> {
    if (customerId) return customerId;
    if (!walkInName.trim()) {
      throw new Error('Select a customer or enter walk-in name');
    }
    const created = await createCustomer({
      customer_name: walkInName.trim(),
      phone_number: walkInMobile.trim(),
      registration_type: 'Unregistered',
      country: 'India',
    }).unwrap();
    const newId = String(created.id || '');
    if (!newId) throw new Error('Failed to create walk-in customer');
    setCustomerId(newId);
    return newId;
  }

  async function onSave() {
    setError(null);
    if (isEdit && !monthEditable) {
      setError('Invoices can only be edited in the same calendar month.');
      return;
    }
    try {
      const cid = await resolveCustomerId();
      const payloadLines = editorLinesToPayload(previewLines, locationId);
      if (!payloadLines.length) {
        setError('Add at least one product line.');
        return;
      }
      if (!storeAccountId) {
        setError('Select a store account.');
        return;
      }
      if (!isEdit && !locationId) {
        setError('Set a working location before saving.');
        return;
      }
      if (!invoiceNumber.trim()) {
        setError('Enter a store invoice number.');
        return;
      }
      // Server applies invoice_discount as ₹ — always send resolved amount (preview already used mode).
      const body: Record<string, unknown> = {
        customer_id: cid,
        store_account_id: storeAccountId,
        store_invoice_number: invoiceNumber.trim(),
        voucher_date: voucherDate,
        due_date: dueDate || voucherDate || undefined,
        location_id: locationId,
        amount_received: Number(amountReceived) || 0,
        credit_applied: Number(creditApplied) || 0,
        advance_applied: Number(advanceApplied) || 0,
        invoice_discount: invoiceDiscountAmount,
        invoice_discount_mode: 'flat',
        commission_agent_ids: commissionIds,
        sales_rep_ids: salesRepIds,
        terms_and_conditions: terms,
        bank_account_id: bankAccountId || undefined,
        custom_values: customValues,
        lines: payloadLines,
      };
      if (isEdit) {
        const saved = await updateInv({ id: editId, body }).unwrap();
        navigate(`/sales/invoices/${saved.id || editId}`);
      } else {
        const created = await createInv(body).unwrap();
        navigate(`/sales/invoices/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : extractError(e));
    }
  }

  if (isEdit && loadingExisting) {
    return <p>Loading invoice…</p>;
  }

  const customerOptions = customers.map((c) => ({
    value: String(c.id),
    label: asCaption(c.customer_name || c.name) || String(c.id),
    sublabel: asCaption(c.phone_number || c.mobile) || undefined,
  }));

  return (
    <DocumentEditor
      title={isEdit ? 'Edit sales invoice' : 'New sales invoice'}
      onCancel={() => navigate(isEdit ? `/sales/invoices/${editId}` : '/sales/invoices')}
      onSave={onSave}
      saving={saving}
      error={error}
      saveLabel={isEdit ? 'Update invoice' : 'Create invoice'}
      body={
        <div style={{ display: 'grid', gap: 16 }}>
          {isEdit && !monthEditable ? (
            <ErrorText>This invoice is outside the current month and cannot be saved.</ErrorText>
          ) : null}
          <LineItemsGrid
            lines={previewLines}
            products={productOptions}
            showDiscount
            disabled={isEdit && !monthEditable}
            onChange={setLines}
            onProductSelected={onProductSelected}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button type="button" variant="ghost" onClick={reapplyDiscounts}>
              Re-apply discounts
            </Button>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'grid', gap: 10, minWidth: 280 }}>
          <FormRow label="Invoice discount">
            <DiscountInput
              value={invoiceDiscountInput}
              mode={invoiceDiscountMode}
              disabled={isEdit && !monthEditable}
              onChange={({ value, mode }) => {
                setInvoiceDiscountInput(value);
                setInvoiceDiscountMode(mode);
              }}
            />
          </FormRow>
          <MoneySummary
            items={[
              { label: 'Taxable', value: summary.taxable },
              { label: 'CGST', value: summary.cgst },
              { label: 'SGST', value: summary.sgst },
              ...(summary.igst ? [{ label: 'IGST', value: summary.igst }] : []),
              { label: 'Tax', value: summary.total_tax },
              { label: 'Grand total', value: summary.grand_total },
            ]}
          />
          {customerId ? (
            <div style={{ fontSize: 13, color: 'var(--vb-color-muted, #667)' }}>
              Credit available: {formatMoney(creditBal)} · Advance: {formatMoney(advanceBal)}
            </div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <FormRow label="Credit applied">
              <TextInput
                value={creditApplied}
                onChange={(e) => setCreditApplied(e.target.value)}
                disabled={isEdit && !monthEditable}
              />
            </FormRow>
            <FormRow label="Advance applied">
              <TextInput
                value={advanceApplied}
                onChange={(e) => setAdvanceApplied(e.target.value)}
                disabled={isEdit && !monthEditable}
              />
            </FormRow>
            <FormRow label="Amount received">
              <TextInput
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                disabled={isEdit && !monthEditable}
              />
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
        <FormRow label="Customer *">
          <SearchableSelect
            options={customerOptions}
            value={customerId}
            placeholder="Select customer"
            disabled={isEdit && !monthEditable}
            onChange={setCustomerId}
          />
        </FormRow>
        <FormRow label="Invoice #">
          <TextInput
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Auto if blank"
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
        <FormRow label="Store account *">
          <Select
            value={storeAccountId}
            onChange={(e) => setStoreAccountId(e.target.value)}
            disabled={isEdit && !monthEditable}
          >
            <option value="">Select account</option>
            {storeAccounts.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {asCaption(a.account_name || a.name)}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>

      {!customerId ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 10,
          }}
        >
          <FormRow label="New customer name">
            <TextInput value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          </FormRow>
          <FormRow label="Mobile">
            <TextInput value={walkInMobile} onChange={(e) => setWalkInMobile(e.target.value)} />
          </FormRow>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 10,
        }}
      >
        <FormRow label="Commission agents">
          <div style={{ display: 'grid', gap: 4, maxHeight: 120, overflow: 'auto' }}>
            {agents.map((a) => {
              const aid = String(a.id);
              return (
                <label key={aid} style={{ display: 'flex', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={commissionIds.includes(aid)}
                    disabled={isEdit && !monthEditable}
                    onChange={() => setCommissionIds((prev) => toggleId(prev, aid))}
                  />
                  {asCaption(a.name || a.agent_name || a.customer_name) || aid}
                </label>
              );
            })}
            {agents.length === 0 ? <span style={{ fontSize: 13, color: '#667' }}>None</span> : null}
          </div>
        </FormRow>
        <FormRow label="Sales reps">
          <div style={{ display: 'grid', gap: 4, maxHeight: 120, overflow: 'auto' }}>
            {(workers.length ? workers : agents).map((w) => {
              const wid = String(w.id);
              return (
                <label key={wid} style={{ display: 'flex', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={salesRepIds.includes(wid)}
                    disabled={isEdit && !monthEditable}
                    onChange={() => setSalesRepIds((prev) => toggleId(prev, wid))}
                  />
                  {asCaption(w.name || w.worker_name || w.agent_name) || wid}
                </label>
              );
            })}
          </div>
        </FormRow>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 10,
        }}
      >
        <FormRow label="Terms & conditions">
          <TextArea
            rows={3}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            disabled={isEdit && !monthEditable}
          />
        </FormRow>
        <FormRow label="Bank on document">
          <Select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            disabled={isEdit && !monthEditable}
          >
            <option value="">Default</option>
            {bankAccounts.map((b, i) => {
              const bid = String(b.id ?? b.account_id ?? i);
              return (
                <option key={bid} value={bid}>
                  {asCaption(b.account_name || b.bank_name || b.name) || bid}
                </option>
              );
            })}
          </Select>
        </FormRow>
      </div>
      {customFieldDefs.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginTop: 10,
          }}
        >
          {customFieldDefs.map((field) => (
            <FormRow key={field.key} label={field.required ? `${field.label} *` : field.label}>
              <TextInput
                value={customValues[field.key] || ''}
                onChange={(e) =>
                  setCustomValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={isEdit && !monthEditable}
              />
            </FormRow>
          ))}
        </div>
      ) : null}
    </DocumentEditor>
  );
}

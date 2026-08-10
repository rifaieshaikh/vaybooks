import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { EditorLineItem, ReceiveSourceLine } from '@vaybooks/ui-kit';
import {
  DocumentEditor,
  FormRow,
  LineItemsGrid,
  ReceiveGrid,
  SearchableSelect,
  Select,
  TextArea,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useCreateGoodsReceiptMutation,
  useGetPurchaseOrderQuery,
  useListInventoryProductsQuery,
  useListPurchaseOrdersQuery,
  useListVendorsQuery,
} from '@vaybooks/store';
import { asCaption, extractError } from '../utils';
import { mapProductsToLineOptions, todayISO } from './linePreview';
import { useWorkingLocation } from './useWorkingLocation';

type GrnReceiveLine = ReceiveSourceLine & {
  productId: string;
  purchaseOrderLineId: string;
};

export function GoodsReceiptEditorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const { data: vendors = [] } = useListVendorsQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: orders = [] } = useListPurchaseOrdersQuery();
  const { locationId } = useWorkingLocation();
  const [createGrn, createState] = useCreateGoodsReceiptMutation();

  const [vendorId, setVendorId] = useState(() => params.get('vendor_id') || '');
  const [poId, setPoId] = useState(() => params.get('purchase_order_id') || '');
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [freight, setFreight] = useState('0');
  const [duty, setDuty] = useState('0');
  const [other, setOther] = useState('0');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(true);
  const [receiveLines, setReceiveLines] = useState<GrnReceiveLine[]>([]);
  const [manualLines, setManualLines] = useState<EditorLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: poDetail } = useGetPurchaseOrderQuery(poId, { skip: !poId });
  const productOptions = useMemo(() => mapProductsToLineOptions(products), [products]);
  const useReceiveGrid = Boolean(poId);

  useEffect(() => {
    if (!poId || !poDetail) {
      if (!poId) setReceiveLines([]);
      return;
    }
    if (poDetail.vendor_id && !vendorId) setVendorId(String(poDetail.vendor_id));
    const poLines = Array.isArray(poDetail.lines) ? poDetail.lines : [];
    setReceiveLines(
      poLines.map((line, index) => {
        const r = line as Record<string, unknown>;
        const pid = String(r.product_id ?? '');
        const product = products.find((p) => String(p.id) === pid);
        const lineId = String(r.id ?? `po-line-${index}`);
        return {
          id: lineId,
          productLabel:
            asCaption(r.product_name) ||
            asCaption(product?.name || product?.product_name) ||
            pid,
          orderedQty: Number(r.qty_ordered ?? r.qty ?? 0) || 0,
          receivedQty: Number(r.qty_ordered ?? r.qty ?? 0) || 0,
          rate: Number(r.rate ?? 0) || 0,
          productId: pid,
          purchaseOrderLineId: lineId,
        };
      }),
    );
  }, [poId, poDetail, products, vendorId]);

  function onProductSelected(index: number, productId: string) {
    const product = productOptions.find((p) => p.id === productId);
    setManualLines((prev) => {
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

      let lines: Record<string, unknown>[] = [];
      if (useReceiveGrid) {
        lines = receiveLines
          .filter((l) => Number(l.receivedQty) > 0 && l.productId)
          .map((l) => ({
            product_id: l.productId,
            qty_received: Number(l.receivedQty) || 0,
            rate: Number(l.rate) || 0,
            purchase_order_line_id: l.purchaseOrderLineId || l.id,
            product_name: l.productLabel,
          }));
      } else {
        lines = manualLines
          .filter((l) => l.productId && Number(l.qty) > 0)
          .map((l) => ({
            product_id: l.productId,
            qty_received: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
          }));
      }

      if (!lines.length) {
        setError('Add at least one received line.');
        return;
      }

      const created = await createGrn({
        vendor_id: vendorId,
        receipt_date: receiptDate || undefined,
        purchase_order_id: poId || undefined,
        location_id: locationId,
        freight: Number(freight) || 0,
        duty: Number(duty) || 0,
        other: Number(other) || 0,
        notes,
        confirm,
        lines,
      }).unwrap();
      navigate(`/purchases/goods-receipt/${created.id}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <DocumentEditor
      title="New goods receipt"
      onCancel={() => navigate('/purchases/goods-receipt')}
      onSave={onSave}
      saving={createState.isLoading}
      error={error}
      saveLabel="Create GRN"
      body={
        useReceiveGrid ? (
          <ReceiveGrid
            lines={receiveLines}
            onChange={(next) =>
              setReceiveLines((prev) =>
                next.map((row, i) => ({
                  ...row,
                  productId: prev[i]?.productId || '',
                  purchaseOrderLineId: prev[i]?.purchaseOrderLineId || row.id,
                })),
              )
            }
          />
        ) : (
          <LineItemsGrid
            lines={manualLines}
            products={productOptions}
            showDiscount={false}
            onChange={setManualLines}
            onProductSelected={onProductSelected}
          />
        )
      }
      footer={
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          Confirm on create (post stock)
        </label>
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
        <FormRow label="Purchase order">
          <Select
            value={poId}
            onChange={(e) => {
              setPoId(e.target.value);
              if (!e.target.value) setReceiveLines([]);
            }}
          >
            <option value="">Manual entry</option>
            {orders.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {asCaption(o.po_number) || String(o.id)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Receipt date">
          <TextInput
            type="date"
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Freight">
          <TextInput value={freight} onChange={(e) => setFreight(e.target.value)} />
        </FormRow>
        <FormRow label="Duty">
          <TextInput value={duty} onChange={(e) => setDuty(e.target.value)} />
        </FormRow>
        <FormRow label="Other">
          <TextInput value={other} onChange={(e) => setOther(e.target.value)} />
        </FormRow>
      </div>
      <FormRow label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </DocumentEditor>
  );
}

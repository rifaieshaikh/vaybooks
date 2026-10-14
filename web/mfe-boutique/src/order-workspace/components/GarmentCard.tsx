import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAddBoutiqueOrderItemMutation,
  useLazyGetBoutiqueItemPdfQuery,
  useCan,
  useListInventoryCategoriesQuery,
  useListInventorySkusQuery,
  useRemoveBoutiqueOrderItemMutation,
  useUpdateBoutiqueOrderItemMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, Modal, SearchableSelect, TextInput } from '@vaybooks/ui-kit';
import { defaultRequiredActivities } from '../../activityDefaults';
import { asCaption, extractError, formatMoney } from '../../utils';
import { garmentSchema, type GarmentValues } from '../schemas';
import { itemId as resolveItemId, type ItemLike } from '../types';
import { ActivityChecklist } from './ActivityChecklist';
import { GarmentMediaPanel } from './GarmentMediaPanel';
import { MeasurementPicker } from './MeasurementPicker';

type Props = {
  orderId: string;
  customerId: string;
  item?: ItemLike;
  draftSeed?: Partial<GarmentValues>;
  catalog: Record<string, unknown>[];
  measurements: Record<string, unknown>[];
  orderActivities?: ItemLike[];
  orderEtd?: string;
  readOnly?: boolean;
  defaultOpen?: boolean;
  onSaved: () => void;
  onDuplicate: (seed: Partial<GarmentValues>) => void;
  onDiscardNew?: () => void;
  onMediaCount?: (itemId: string, count: number) => void;
  onModalOpenChange?: (open: boolean) => void;
  onMeasurementsChanged?: () => void;
};

export function GarmentCard({
  orderId,
  customerId,
  item,
  draftSeed,
  catalog,
  measurements,
  orderActivities = [],
  orderEtd,
  readOnly,
  defaultOpen,
  onSaved,
  onDuplicate,
  onDiscardNew,
  onMediaCount,
  onModalOpenChange,
  onMeasurementsChanged,
}: Props) {
  const existingId = item ? resolveItemId(item) : '';
  const [open, setOpen] = useState(Boolean(defaultOpen || !existingId));
  const [error, setError] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [addItem, addState] = useAddBoutiqueOrderItemMutation();
  const [updateItem, updateState] = useUpdateBoutiqueOrderItemMutation();
  const [removeItem, removeState] = useRemoveBoutiqueOrderItemMutation();
  const [fetchPdf] = useLazyGetBoutiqueItemPdfQuery();
  const can = useCan();
  const canEditCategory =
    can('boutique.items.category.edit') && can('inventory.categories.view');
  const { data: categories = [] } = useListInventoryCategoriesQuery(
    { active_only: true },
    { skip: !canEditCategory },
  );
  const { data: skus = [] } = useListInventorySkusQuery(
    { active_only: true },
    { skip: readOnly },
  );
  const categoryOptions = useMemo(
    () => [
      { value: '', label: '— No category —' },
      ...(categories as Record<string, unknown>[]).map((category) => ({
        value: asCaption(category.id),
        label: asCaption(category.name) || asCaption(category.id),
      })),
    ],
    [categories],
  );
  const skuOptions = useMemo(
    () => [
      { value: '', label: '— No SKU —' },
      ...(skus as Record<string, unknown>[]).map((sku) => ({
        value: asCaption(sku.id),
        label: `${asCaption(sku.name) || asCaption(sku.id)}${
          sku.sku ? ` (${asCaption(sku.sku)})` : ''
        }`,
      })),
    ],
    [skus],
  );

  const form = useForm<GarmentValues>({
    resolver: zodResolver(garmentSchema),
    defaultValues: {
      description: asCaption(item?.description) || draftSeed?.description || '',
      customerSpecification:
        asCaption(item?.customer_specification) || draftSeed?.customerSpecification || '',
      sellAmount: parseAmount(item?.sell_amount ?? draftSeed?.sellAmount),
      expectedDeliveryDate:
        asCaption(item?.expected_delivery_date).slice(0, 10) ||
        draftSeed?.expectedDeliveryDate ||
        orderEtd ||
        '',
      measurementId: asCaption(item?.measurement_id) || draftSeed?.measurementId || '',
      categoryId: asCaption(item?.category_id) || draftSeed?.categoryId || '',
      skuId: asCaption(item?.sku_id) || draftSeed?.skuId || '',
      billNumber: asCaption(item?.bill_number) || draftSeed?.billNumber || '',
      requiredActivities:
        draftSeed?.requiredActivities ||
        (item
          ? activityMapFromOrder(existingId, orderActivities, catalog)
          : defaultRequiredActivities(catalog)),
      activityEstimatedHours:
        draftSeed?.activityEstimatedHours ||
        (item ? hoursMapFromOrder(existingId, orderActivities) : {}),
    },
  });

  const measurementId = form.watch('measurementId');
  const busy = addState.isLoading || updateState.isLoading || removeState.isLoading;

  // After measurement link, server may assign a bill number — reflect it.
  useEffect(() => {
    if (!item) return;
    const serverBill = asCaption(item.bill_number);
    if (serverBill && serverBill !== form.getValues('billNumber')) {
      form.setValue('billNumber', serverBill);
    }
  }, [item?.bill_number, item, form]);

  // Catalog often loads after mount — seed defaults for new garments.
  useEffect(() => {
    if (existingId || draftSeed?.requiredActivities) return;
    if (!catalog.length) return;
    const current = form.getValues('requiredActivities') || {};
    if (Object.keys(current).length > 0) return;
    form.setValue('requiredActivities', defaultRequiredActivities(catalog));
  }, [catalog, existingId, draftSeed, form]);

  useEffect(() => {
    if (measurementId) form.clearErrors('billNumber');
  }, [measurementId, form]);

  async function onSave(values: GarmentValues) {
    setError('');
    const description = String(values.description || '').trim();
    if (!description) {
      form.setError('description', { message: 'Description is required' });
      return;
    }
    const sellAmount = parseAmount(values.sellAmount);
    const body = {
      description,
      customer_specification: values.customerSpecification || undefined,
      sell_amount: sellAmount,
      expected_delivery_date: values.expectedDeliveryDate || undefined,
      measurement_id: values.measurementId || undefined,
      ...(canEditCategory ? { category_id: values.categoryId || null } : {}),
      sku_id: values.skuId || null,
      catalog_product_id: (() => {
        const selected = (skus as Record<string, unknown>[]).find(
          (row) => asCaption(row.id) === String(values.skuId || ''),
        );
        return selected
          ? asCaption(selected.catalog_product_id) || null
          : asCaption(item?.catalog_product_id) || null;
      })(),
      // With a measurement, bill is assigned server-side; keep existing if already set.
      bill_number: values.measurementId
        ? String(values.billNumber || item?.bill_number || '').trim()
        : String(values.billNumber || '').trim(),
      required_activities: values.requiredActivities,
      activity_estimated_hours: hoursPayload(
        values.requiredActivities,
        values.activityEstimatedHours,
        catalog,
      ),
    };
    try {
      if (existingId) {
        await updateItem({
          orderId,
          itemId: existingId,
          body: {
            ...body,
            measurement_id: values.measurementId || '',
          },
        }).unwrap();
      } else {
        await addItem({ orderId, body }).unwrap();
        onDiscardNew?.();
      }
      onSaved();
    } catch (e) {
      const msg = extractError(e);
      if (/bill/i.test(msg) && /exist/i.test(msg)) {
        form.setError('billNumber', { message: msg });
      }
      setError(msg);
    }
  }

  async function onRemove() {
    if (!existingId) {
      onDiscardNew?.();
      setRemoveOpen(false);
      onModalOpenChange?.(false);
      return;
    }
    setError('');
    try {
      await removeItem({ orderId, itemId: existingId }).unwrap();
      setRemoveOpen(false);
      onModalOpenChange?.(false);
      onSaved();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onPdf() {
    if (!existingId) return;
    try {
      const blob = await fetchPdf({ orderId, itemId: existingId }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asCaption(item?.bill_number) || existingId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(extractError(e));
    }
  }

  const title =
    form.watch('description') ||
    asCaption(item?.description) ||
    (existingId ? 'Garment' : 'New garment');

  return (
    <div className={`ow-garment${open ? ' is-open' : ''}`}>
      <div className="ow-garment-head" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        <div>
          <strong>{title}</strong>
          <div style={{ fontSize: 13, color: 'var(--ow-muted)' }}>
            {asCaption(item?.bill_number) || (measurementId ? 'Bill from measurement' : 'No bill')}
            {' · '}
            {formatMoney(Number(form.watch('sellAmount') || 0))}
          </div>
        </div>
        <span className="ow-chip">{open ? 'Collapse' : 'Expand'}</span>
      </div>

      {open ? (
        <form className="ow-garment-body" onSubmit={form.handleSubmit(onSave)}>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <div className="ow-grid two">
            <FormRow label="Description *">
              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <TextInput
                    disabled={readOnly}
                    value={field.value || ''}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(e.target.value)}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
              {form.formState.errors.description ? (
                <ErrorText>{form.formState.errors.description.message}</ErrorText>
              ) : null}
            </FormRow>
            <FormRow label="Estimate amount">
              <Controller
                control={form.control}
                name="sellAmount"
                render={({ field }) => (
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    disabled={readOnly}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={
                      field.value === undefined || field.value === null || Number.isNaN(field.value)
                        ? ''
                        : String(field.value)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        field.onChange(0);
                        return;
                      }
                      const n = Number(raw);
                      field.onChange(Number.isFinite(n) ? n : 0);
                    }}
                  />
                )}
              />
              {form.formState.errors.sellAmount ? (
                <ErrorText>{form.formState.errors.sellAmount.message}</ErrorText>
              ) : null}
            </FormRow>
            <FormRow label="Item ETD">
              <TextInput
                type="date"
                disabled={readOnly}
                {...form.register('expectedDeliveryDate')}
              />
            </FormRow>
            <FormRow label="Bill number">
              <TextInput
                disabled={readOnly || Boolean(measurementId)}
                placeholder={measurementId ? 'Assigned from measurement' : 'Required without measurement'}
                {...form.register('billNumber')}
              />
              {form.formState.errors.billNumber ? (
                <ErrorText>{form.formState.errors.billNumber.message}</ErrorText>
              ) : null}
            </FormRow>
          </div>

          <FormRow label="Customer specification">
            <textarea
              className="vb-control"
              rows={2}
              disabled={readOnly}
              {...form.register('customerSpecification')}
            />
          </FormRow>

          {canEditCategory ? (
            <FormRow label="Inventory category">
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <SearchableSelect
                    options={categoryOptions}
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={readOnly}
                    placeholder="Select category"
                  />
                )}
              />
            </FormRow>
          ) : null}

          {!readOnly || form.watch('skuId') ? (
            <FormRow label="Linked SKU">
              <Controller
                control={form.control}
                name="skuId"
                render={({ field }) => (
                  <SearchableSelect
                    options={skuOptions}
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={readOnly}
                    placeholder="Select SKU (optional)"
                  />
                )}
              />
            </FormRow>
          ) : null}

          <Controller
            control={form.control}
            name="measurementId"
            render={({ field }) => (
              <MeasurementPicker
                customerId={customerId}
                orderId={orderId}
                measurements={measurements}
                value={field.value || ''}
                readOnly={readOnly}
                onChange={(id) => {
                  field.onChange(id);
                  if (id) form.setValue('billNumber', '');
                }}
                onChanged={onMeasurementsChanged}
                onModalOpenChange={onModalOpenChange}
              />
            )}
          />

          <div>
            <strong>Required activities</strong>
            <Controller
              control={form.control}
              name="requiredActivities"
              render={({ field }) => (
                <ActivityChecklist
                  activities={catalog}
                  value={field.value || {}}
                  hours={form.watch('activityEstimatedHours') || {}}
                  onChange={field.onChange}
                  onHoursChange={(next) => form.setValue('activityEstimatedHours', next)}
                  disabled={readOnly}
                />
              )}
            />
            {form.formState.errors.requiredActivities ? (
              <ErrorText>
                {String(form.formState.errors.requiredActivities.message || 'Select activities')}
              </ErrorText>
            ) : null}
          </div>

          {existingId ? (
            <GarmentMediaPanel
              orderId={orderId}
              itemId={existingId}
              readOnly={readOnly}
              onCountChange={(n) => onMediaCount?.(existingId, n)}
            />
          ) : (
            <div className="ow-banner">Save the garment to attach media.</div>
          )}

          <div className="ow-actions">
            {!readOnly ? (
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : existingId ? 'Save garment' : 'Add garment'}
              </Button>
            ) : null}
            {existingId ? (
              <Button type="button" variant="ghost" onClick={() => void onPdf()}>
                Item PDF
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onDuplicate({
                  description: form.getValues('description'),
                  customerSpecification: form.getValues('customerSpecification'),
                  sellAmount: form.getValues('sellAmount'),
                  expectedDeliveryDate: form.getValues('expectedDeliveryDate'),
                  requiredActivities: { ...form.getValues('requiredActivities') },
                  activityEstimatedHours: { ...form.getValues('activityEstimatedHours') },
                  measurementId: '',
                  categoryId: form.getValues('categoryId'),
                  skuId: form.getValues('skuId'),
                  billNumber: '',
                })
              }
            >
              Duplicate
            </Button>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRemoveOpen(true);
                  onModalOpenChange?.(true);
                }}
              >
                {existingId ? 'Remove' : 'Discard'}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      <Modal
        open={removeOpen}
        title={existingId ? 'Remove garment?' : 'Discard draft garment?'}
        onClose={() => {
          setRemoveOpen(false);
          onModalOpenChange?.(false);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRemoveOpen(false);
                onModalOpenChange?.(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void onRemove()} disabled={removeState.isLoading}>
              {existingId ? 'Remove' : 'Discard'}
            </Button>
          </>
        }
      >
        <p>
          {existingId
            ? 'This removes the item, its pending activities, and attachments.'
            : 'Unsaved garment will be discarded.'}
        </p>
      </Modal>
    </div>
  );
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function activityMapFromOrder(
  itemKey: string,
  activities: ItemLike[],
  catalog: Record<string, unknown>[],
): Record<string, boolean> {
  const map = defaultRequiredActivities(catalog);
  for (const key of Object.keys(map)) map[key] = false;
  for (const act of activities) {
    if (String(act.bill_id || '') !== itemKey) continue;
    const name = String(act.activity_name || '');
    if (name) map[name] = Boolean(act.is_required !== false);
  }
  if (!Object.values(map).some(Boolean)) {
    return defaultRequiredActivities(catalog);
  }
  return map;
}

function hoursMapFromOrder(itemKey: string, activities: ItemLike[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const act of activities) {
    if (String(act.bill_id || '') !== itemKey) continue;
    const name = String(act.activity_name || '');
    if (!name) continue;
    const hrs = Number(act.estimated_hours ?? 0);
    if (hrs > 0) map[name] = hrs;
  }
  return map;
}

function hoursPayload(
  required: Record<string, boolean>,
  hours: Record<string, number>,
  catalog: Record<string, unknown>[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const act of catalog) {
    const name = String(act.activity_name || act.name || '');
    if (!name || !required[name]) continue;
    const inHouse =
      typeof act.is_in_house === 'boolean'
        ? act.is_in_house
        : String(act.activity_category || '')
            .toLowerCase()
            .includes('in_house');
    if (!inHouse) continue;
    out[name] = Math.max(0, Number(hours[name]) || 0);
  }
  return out;
}

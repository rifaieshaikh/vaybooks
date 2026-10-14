import { useState } from 'react';
import {
  useCreateBoutiqueMeasurementMutation,
  useDeleteBoutiqueMeasurementMutation,
  useLazyGetBoutiqueMeasurementPdfQuery,
  useListBoutiqueMeasurementSpecsQuery,
  useUpdateBoutiqueMeasurementMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, Modal } from '@vaybooks/ui-kit';
import {
  MeasurementForm,
  measurementFormMissingRequired,
  type MeasurementFormValue,
} from '../../MeasurementForm';
import { asCaption, extractError } from '../../utils';

type Props = {
  customerId: string;
  orderId: string;
  measurements: Record<string, unknown>[];
  value: string;
  onChange: (id: string) => void;
  onChanged?: () => void;
  readOnly?: boolean;
  onModalOpenChange?: (open: boolean) => void;
};

export function MeasurementPicker({
  customerId,
  orderId,
  measurements,
  value,
  onChange,
  onChanged,
  readOnly,
  onModalOpenChange,
}: Props) {
  const { data: specs = [] } = useListBoutiqueMeasurementSpecsQuery();
  const [createMeas] = useCreateBoutiqueMeasurementMutation();
  const [updateMeas] = useUpdateBoutiqueMeasurementMutation();
  const [deleteMeas] = useDeleteBoutiqueMeasurementMutation();
  const [fetchPdf] = useLazyGetBoutiqueMeasurementPdfQuery();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<MeasurementFormValue | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  const specsEmpty = specs.filter((s) => s.is_active !== false).length === 0;

  function setModal(next: boolean, editing = '') {
    setOpen(next);
    setEditId(editing);
    onModalOpenChange?.(next);
    if (!next) setForm(null);
  }

  function setDeleteModal(id: string) {
    setConfirmDelete(id);
    onModalOpenChange?.(Boolean(id));
  }

  async function onSave() {
    setError('');
    if (!customerId || !form) return;
    const missing = measurementFormMissingRequired(specs, form.person_type, form.values);
    if (missing.length) {
      setError(`Missing required: ${missing.join(', ')}`);
      return;
    }
    try {
      if (editId) {
        await updateMeas({ id: editId, body: { ...form } }).unwrap();
      } else {
        const created = await createMeas({
          customer_id: customerId,
          order_id: orderId || undefined,
          ...form,
        }).unwrap();
        onChange(String(created.id));
      }
      setModal(false);
      onChanged?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onDelete() {
    if (!confirmDelete) return;
    setError('');
    try {
      await deleteMeas(confirmDelete).unwrap();
      if (value === confirmDelete) onChange('');
      setDeleteModal('');
      onChanged?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onPrint(id: string) {
    setError('');
    try {
      const blob = await fetchPdf(id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurement-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(extractError(e));
    }
  }

  const editing = measurements.find((m) => String(m.id) === editId);

  return (
    <div className="ow-grid">
      {specsEmpty ? (
        <div className="ow-banner">
          No measurement specs configured.{' '}
          <a href="/settings/measurement-specs">Open measurement specs settings</a>
        </div>
      ) : null}

      <FormRow label="Link measurement">
        <select
          className="vb-control"
          value={value}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">None — enter bill number</option>
          {measurements.map((m) => (
            <option key={String(m.id)} value={String(m.id)}>
              {asCaption(m.measurement_number)} · {asCaption(m.person_type)} ·{' '}
              {asCaption(m.wearer_name)}
            </option>
          ))}
        </select>
      </FormRow>

      {!readOnly ? (
        <div className="ow-actions" style={{ marginTop: 0 }}>
          {!specsEmpty ? (
            <Button type="button" variant="ghost" onClick={() => setModal(true)}>
              Add measurement
            </Button>
          ) : null}
          {value ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModal(true, value)}
              >
                Edit
              </Button>
              <Button type="button" variant="ghost" onClick={() => void onPrint(value)}>
                Print PDF
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDeleteModal(value)}>
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ) : value ? (
        <div className="ow-actions" style={{ marginTop: 0 }}>
          <Button type="button" variant="ghost" onClick={() => void onPrint(value)}>
            Print PDF
          </Button>
        </div>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Modal
        open={open}
        wide
        title={editId ? 'Edit measurement' : 'Add measurement'}
        onClose={() => setModal(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onSave()}>
              Save
            </Button>
          </>
        }
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <MeasurementForm
            key={editId || 'new'}
            personTypeLocked={Boolean(editId)}
            initial={
              editing
                ? ({
                    person_type: asCaption(editing.person_type),
                    wearer_name: asCaption(editing.wearer_name),
                    wearer_age: asCaption(editing.wearer_age),
                    wearer_height: asCaption(editing.wearer_height),
                    wearer_weight: asCaption(editing.wearer_weight),
                    fit_preference: asCaption(editing.fit_preference) || 'Regular',
                    unit: asCaption(editing.unit) || 'inch',
                    measured_by: asCaption(editing.measured_by),
                    measured_at: asCaption(editing.measured_at),
                    notes: asCaption(editing.notes),
                    print_notes: asCaption(editing.print_notes),
                    values: Array.isArray(editing.values)
                      ? (editing.values as Record<string, unknown>[])
                      : [],
                  } as Partial<MeasurementFormValue> & { values?: Record<string, unknown>[] })
                : undefined
            }
            onChange={setForm}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete measurement?"
        onClose={() => setDeleteModal('')}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDeleteModal('')}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p>This cannot be undone. Linked garments will block delete on the server.</p>
      </Modal>
    </div>
  );
}

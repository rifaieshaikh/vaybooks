import { useEffect, useMemo, useState } from 'react';
import {
  useCreateRecipeMutation,
  useGetProductionSettingsQuery,
  useListInventoryProductsQuery,
  useUpdateRecipeMutation,
} from '@vaybooks/store';
import {
  Button,
  ErrorText,
  FormRow,
  Modal,
  SearchableSelect,
  TextInput,
} from '@vaybooks/ui-kit';
import { ALLOCATION_METHODS, OUTPUT_ROLES } from '../status';
import { extractError } from '../utils';

type LineState = {
  key: string;
  product_id: string;
  qty: string;
  scrap_pct: string;
  role: string;
  allocation_pct: string;
  nrv_rate: string;
};

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyInput(): LineState {
  return {
    key: newKey(),
    product_id: '',
    qty: '1',
    scrap_pct: '0',
    role: 'Main',
    allocation_pct: '0',
    nrv_rate: '0',
  };
}

function emptyOutput(role = 'Main'): LineState {
  return { ...emptyInput(), role };
}

export function RecipeEditorModal({
  open,
  recipe,
  onClose,
  onSaved,
}: {
  open: boolean;
  recipe: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(recipe?.id);
  const { data: products = [] } = useListInventoryProductsQuery();
  const { data: settings } = useGetProductionSettingsQuery();
  const [createRecipe, createState] = useCreateRecipeMutation();
  const [updateRecipe, updateState] = useUpdateRecipeMutation();
  const [advanced, setAdvanced] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [baseQty, setBaseQty] = useState('1');
  const [allocation, setAllocation] = useState('NRV');
  const [active, setActive] = useState(true);
  const [stagesText, setStagesText] = useState('');
  const [inputs, setInputs] = useState<LineState[]>([emptyInput()]);
  const [outputs, setOutputs] = useState<LineState[]>([emptyOutput()]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: String(p.name || p.sku || p.id),
        sublabel: String(p.sku || ''),
      })),
    [products],
  );

  useEffect(() => {
    if (!open) return;
    setFormError('');
    if (!recipe) {
      setAdvanced(false);
      setName('');
      setCode('');
      setDescription('');
      setBaseQty('1');
      setAllocation(String(settings?.default_allocation_method || 'NRV'));
      setActive(true);
      setStagesText('');
      setInputs([emptyInput()]);
      setOutputs([emptyOutput()]);
      return;
    }
    setName(String(recipe.name || ''));
    setCode(String(recipe.code || ''));
    setDescription(String(recipe.description || ''));
    setBaseQty(String(recipe.base_quantity ?? 1));
    setAllocation(String(recipe.allocation_method || 'NRV'));
    setActive(recipe.is_active !== false);
    const stageRows = Array.isArray(recipe.stages) ? (recipe.stages as Record<string, unknown>[]) : [];
    setStagesText(stageRows.map((s) => String(s.name || '')).filter(Boolean).join('\n'));
    const inRows = Array.isArray(recipe.inputs) ? (recipe.inputs as Record<string, unknown>[]) : [];
    const outRows = Array.isArray(recipe.outputs) ? (recipe.outputs as Record<string, unknown>[]) : [];
    setInputs(
      inRows.length
        ? inRows.map((line) => ({
            key: newKey(),
            product_id: String(line.product_id || ''),
            qty: String(line.qty ?? 1),
            scrap_pct: String(line.scrap_pct ?? 0),
            role: 'Main',
            allocation_pct: '0',
            nrv_rate: '0',
          }))
        : [emptyInput()],
    );
    setOutputs(
      outRows.length
        ? outRows.map((line) => ({
            key: newKey(),
            product_id: String(line.product_id || ''),
            qty: String(line.expected_qty ?? line.qty ?? 1),
            scrap_pct: '0',
            role: String(line.role || 'Main'),
            allocation_pct: String(line.allocation_pct ?? 0),
            nrv_rate: String(line.nrv_rate ?? 0),
          }))
        : [emptyOutput()],
    );
    setAdvanced(
      inRows.some((l) => Number(l.scrap_pct || 0) > 0) ||
        outRows.length > 1 ||
        outRows.some((l) => String(l.role || 'Main') !== 'Main') ||
        stageRows.length > 0,
    );
  }, [open, recipe, settings?.default_allocation_method]);

  const busy = createState.isLoading || updateState.isLoading;

  async function onSave() {
    setFormError('');
    if (!name.trim()) {
      setFormError('Recipe name is required');
      return;
    }
    const inputPayload = inputs
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        qty: Number(l.qty) || 0,
        scrap_pct: advanced ? Number(l.scrap_pct) || 0 : 0,
      }));
    const outputPayload = outputs
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        expected_qty: Number(l.qty) || 0,
        role: advanced ? l.role : 'Main',
        allocation_pct: advanced ? Number(l.allocation_pct) || 0 : 0,
        nrv_rate: advanced ? Number(l.nrv_rate) || 0 : 0,
      }));
    if (!inputPayload.length || !outputPayload.length) {
      setFormError('Add at least one input and one output product');
      return;
    }
    if (!outputPayload.some((l) => l.role === 'Main')) {
      setFormError('At least one Main output is required');
      return;
    }
    if (advanced && allocation === 'Percentage') {
      const totalPct = outputPayload.reduce((sum, l) => sum + (Number(l.allocation_pct) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        setFormError(`Output allocation percentages must total 100 (currently ${totalPct})`);
        return;
      }
    }
    const stages = advanced
      ? stagesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((stageName, index) => ({ name: stageName, sequence: index + 1 }))
      : [];
    const body = {
      name: name.trim(),
      code: code.trim(),
      description: description.trim(),
      base_quantity: Number(baseQty) || 1,
      allocation_method: allocation,
      is_active: active,
      inputs: inputPayload,
      outputs: outputPayload,
      stages,
    };
    try {
      if (isEdit) {
        await updateRecipe({ id: String(recipe!.id), body }).unwrap();
      } else {
        const created = await createRecipe(body).unwrap();
        if (!active && created?.id) {
          await updateRecipe({ id: String(created.id), body: { is_active: false } }).unwrap();
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit recipe' : 'New recipe'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={busy}>
            {busy ? 'Saving…' : 'Save recipe'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <p style={{ margin: 0, color: 'var(--vb-color-muted, #667)' }}>
          Recipes are your formula (BOM). Start simple; turn on Advanced for scrap, co-products, and
          stages.
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          Advanced options
        </label>
        <FormRow label="Name *">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Code">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
        </FormRow>
        <FormRow label="Base quantity">
          <TextInput value={baseQty} onChange={(e) => setBaseQty(e.target.value)} />
        </FormRow>
        {advanced ? (
          <>
            <FormRow label="Description">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormRow>
            <FormRow label="Allocation method">
              <select
                className="vb-control"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
              >
                {ALLOCATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormRow>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </>
        ) : null}

        <div>
          <strong>Inputs</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {inputs.map((line, index) => (
              <div
                key={line.key}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr' + (advanced ? ' 1fr' : '') + ' auto', gap: 8 }}
              >
                <SearchableSelect
                  options={productOptions}
                  value={line.product_id}
                  onChange={(value) =>
                    setInputs((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, product_id: value } : r)),
                    )
                  }
                  placeholder="Product…"
                />
                <TextInput
                  value={line.qty}
                  onChange={(e) =>
                    setInputs((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)),
                    )
                  }
                  placeholder="Qty"
                />
                {advanced ? (
                  <TextInput
                    value={line.scrap_pct}
                    onChange={(e) =>
                      setInputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, scrap_pct: e.target.value } : r)),
                      )
                    }
                    placeholder="Scrap %"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setInputs((rows) => rows.filter((_, i) => i !== index))}
                  disabled={inputs.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={() => setInputs((rows) => [...rows, emptyInput()])}>
              Add input
            </Button>
          </div>
        </div>

        <div>
          <strong>Outputs</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {outputs.map((line, index) => (
              <div key={line.key} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8 }}>
                  <SearchableSelect
                    options={productOptions}
                    value={line.product_id}
                    onChange={(value) =>
                      setOutputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, product_id: value } : r)),
                      )
                    }
                    placeholder="Product…"
                  />
                  <TextInput
                    value={line.qty}
                    onChange={(e) =>
                      setOutputs((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)),
                      )
                    }
                    placeholder="Qty"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOutputs((rows) => rows.filter((_, i) => i !== index))}
                    disabled={outputs.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
                {advanced ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <select
                      className="vb-control"
                      value={line.role}
                      onChange={(e) =>
                        setOutputs((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, role: e.target.value } : r)),
                        )
                      }
                    >
                      {OUTPUT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <TextInput
                      value={line.allocation_pct}
                      onChange={(e) =>
                        setOutputs((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, allocation_pct: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Allocation %"
                    />
                    <TextInput
                      value={line.nrv_rate}
                      onChange={(e) =>
                        setOutputs((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, nrv_rate: e.target.value } : r)),
                        )
                      }
                      placeholder="NRV rate"
                    />
                  </div>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOutputs((rows) => [...rows, emptyOutput(advanced ? 'Co-product' : 'Main')])}
            >
              Add output
            </Button>
          </div>
        </div>

        {advanced ? (
          <FormRow label="Activities / stages (one per line)">
            <textarea
              className="vb-control"
              rows={4}
              value={stagesText}
              onChange={(e) => setStagesText(e.target.value)}
              placeholder={'Mix\nBake\nPack'}
            />
          </FormRow>
        ) : null}
      </div>
    </Modal>
  );
}

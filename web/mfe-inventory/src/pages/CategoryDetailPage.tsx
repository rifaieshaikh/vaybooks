import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useCan,
  useGetInventoryCategoryQuery,
  useListInventoryCategoriesQuery,
  useUpdateInventoryCategoryMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityListEmpty,
  EntityListLoading,
  ErrorText,
  FormRow,
  Modal,
  ModalForm,
  ModalFormActions,
  SearchableSelect,
  StatusPill,
  TextInput,
  displayName,
} from '@vaybooks/ui-kit';
import { excludeOption, toCategoryOptions, withNoneOption } from '../pickerOptions';

type EditValues = {
  name: string;
  description: string;
  parent_id: string;
  is_active: boolean;
};

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Save failed');
  }
  return 'Save failed';
}

function formatQty(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function CategoryDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();

  const canOpen = can('inventory.categories.open') || can('inventory.categories.view');
  const canEdit = can('inventory.categories.edit');
  const canDeactivate = can('inventory.categories.deactivate');
  const canOverview = can('inventory.categories.overview.view') || canOpen;

  const {
    data: fetched,
    isLoading,
    isFetching,
    isUninitialized,
    error,
    refetch,
  } = useGetInventoryCategoryQuery(id, {
    skip: !id || !canOpen,
  });

  const { data: listRows = [] } = useListInventoryCategoriesQuery(
    { active_only: false },
    { skip: !canOpen },
  );
  const listed = useMemo(
    () => (listRows as Record<string, unknown>[]).find((row) => String(row.id) === String(id)),
    [listRows, id],
  );
  const data = (fetched as Record<string, unknown> | undefined) || listed;
  const allCategories = listRows;

  const [updateCategory, updateState] = useUpdateInventoryCategoryMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState<EditValues>({
    name: '',
    description: '',
    parent_id: '',
    is_active: true,
  });
  const [formError, setFormError] = useState('');

  const parentOptions = useMemo(
    () => excludeOption(toCategoryOptions(allCategories as Record<string, unknown>[]), id),
    [allCategories, id],
  );

  function openEdit() {
    if (!data || !canEdit) return;
    setFormError('');
    setEditValues({
      name: String(data.name || ''),
      description: String(data.description || ''),
      parent_id: String(data.parent_id || ''),
      is_active: data.is_active !== false,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!id) return;
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        name: editValues.name,
        description: editValues.description,
        parent_id: editValues.parent_id || null,
      };
      if (canDeactivate) body.is_active = editValues.is_active;
      await updateCategory({ id, body }).unwrap();
      setEditOpen(false);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  async function toggleActive() {
    if (!data || !canDeactivate || !id) return;
    await updateCategory({
      id,
      body: {
        name: String(data.name || ''),
        is_active: data.is_active === false,
      },
    }).unwrap();
    refetch();
  }

  if (!canOpen) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <EntityListEmpty>
          <strong>You do not have permission to open this category.</strong>
        </EntityListEmpty>
      </EntityDetailPage>
    );
  }

  if (!id) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>Category not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  if (isUninitialized || ((isLoading || isFetching) && !data)) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <EntityListLoading>Loading category…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error && !data) {
    const status = Number((error as { status?: number }).status || 0);
    const detail =
      status === 403
        ? 'You do not have permission to open this category.'
        : status === 404
          ? 'Category not found.'
          : extractError(error) || 'Failed to load category.';
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>{detail}</ErrorText>
      </EntityDetailPage>
    );
  }

  if (!data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/categories" label="Categories" />
        <ErrorText>Category not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const title = displayName(data as Record<string, unknown>, ['name'], id);
  const path =
    typeof data.path === 'string'
      ? data.path
      : Array.isArray(data.path)
        ? (data.path as string[]).join(' › ')
        : title;
  const inactive = data.is_active === false;
  const parentName = data.parent_id
    ? String(
        (allCategories as Record<string, unknown>[]).find(
          (c) => String(c.id) === String(data.parent_id),
        )?.name || data.parent_id,
      )
    : '— None (top level) —';

  const heroActions = (
    <>
      {canEdit ? (
        <Button type="button" onClick={openEdit}>
          Edit
        </Button>
      ) : null}
      {canDeactivate ? (
        <Button type="button" onClick={() => void toggleActive()}>
          {inactive ? 'Activate' : 'Deactivate'}
        </Button>
      ) : null}
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/inventory/categories" label="Categories" />

      <EntityDetailHero
        kicker="Inventory · Category"
        title={title}
        lead={
          <>
            <StatusPill status={inactive ? 'Inactive' : 'Active'} tone={inactive ? 'warn' : 'success'} />
            <span className="ed-lead-sep"> · {path}</span>
          </>
        }
        actions={heroActions}
      />

      {canOverview ? (
        <EntityDetailPanel
          title="Overview"
          note="Counts include this category and its child categories."
        >
          <EntityDetailSnapshot
            ariaLabel="Category totals"
            items={[
              { label: 'Products', value: Number(data.product_count ?? 0) },
              { label: 'SKUs', value: Number(data.sku_count ?? 0) },
              { label: 'Stock', value: formatQty(data.stock_qty) },
            ]}
          />
          <div className="ed-grid ed-grid-2">
            <FormRow label="Name">
              <TextInput value={String(data.name || '')} readOnly disabled />
            </FormRow>
            <FormRow label="Parent">
              <TextInput value={parentName} readOnly disabled />
            </FormRow>
            <FormRow label="Description">
              <TextInput value={String(data.description || '')} readOnly disabled />
            </FormRow>
            <FormRow label="Status">
              <TextInput value={inactive ? 'Inactive' : 'Active'} readOnly disabled />
            </FormRow>
          </div>
        </EntityDetailPanel>
      ) : null}

      <Modal title="Edit Category" open={editOpen} onClose={() => setEditOpen(false)}>
        <ModalForm onSubmit={() => void saveEdit()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name">
            <TextInput value={editValues.name} readOnly disabled />
          </FormRow>
          <FormRow label="Description">
            <TextInput
              value={editValues.description}
              onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))}
            />
          </FormRow>
          <FormRow label="Parent category">
            <SearchableSelect
              options={withNoneOption(parentOptions, '— None (top level) —')}
              value={editValues.parent_id}
              placeholder="Select parent"
              onChange={(next) => setEditValues((p) => ({ ...p, parent_id: next }))}
            />
          </FormRow>
          {canDeactivate ? (
            <FormRow label="Status">
              <SearchableSelect
                options={[
                  { value: 'yes', label: 'Active' },
                  { value: 'no', label: 'Inactive' },
                ]}
                value={editValues.is_active ? 'yes' : 'no'}
                placeholder="Select status"
                onChange={(next) =>
                  setEditValues((p) => ({ ...p, is_active: next !== 'no' }))
                }
              />
            </FormRow>
          ) : null}
          <ModalFormActions
            busy={updateState.isLoading}
            submitLabel="Save Changes"
            busyLabel="Saving…"
            onCancel={() => setEditOpen(false)}
          />
        </ModalForm>
      </Modal>
    </EntityDetailPage>
  );
}

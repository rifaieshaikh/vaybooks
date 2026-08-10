import { useMemo, useState } from 'react';
import {
  useCreateProductionActivityMutation,
  useDeactivateProductionActivityMutation,
  useListProductionActivitiesQuery,
  useUpdateProductionActivityMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityListActions,
  EntityListEmpty,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  displayName,
  pageCount,
  paginate,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const CATEGORIES = [
  'In House Service',
  'In House Material',
  'Outsourced Service',
  'Outsourced Material',
];

export function ProductionActivitiesPage() {
  const { data = [], isLoading, error, refetch } = useListProductionActivitiesQuery({
    active_only: false,
  });
  const [createActivity, createState] = useCreateProductionActivityMutation();
  const [updateActivity, updateState] = useUpdateProductionActivityMutation();
  const [deactivate] = useDeactivateProductionActivityMutation();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [rate, setRate] = useState('100');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const pages = pageCount(data.length, PAGE_SIZE);
  const pageRows = paginate(data, Math.min(page, pages), PAGE_SIZE);
  type ActivityRow = Record<string, unknown>;

  const columns: EntityListColumn<ActivityRow>[] = useMemo(
    () => [
      {
        id: 'activity_name',
        header: 'Activity',
        render: (row) => displayName(row, ['activity_name'], 'Unnamed'),
      },
      {
        id: 'activity_category',
        header: 'Category',
        render: (row) => asCaption(row.activity_category) || '—',
      },
      {
        id: 'default_hourly_expense',
        header: 'Hourly',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => `₹${Number(row.default_hourly_expense ?? 0)}`,
      },
      {
        id: 'is_active',
        header: 'Active',
        render: (row) => (row.is_active === false ? 'No' : 'Yes'),
      },
    ],
    [],
  );

  function openCreate() {
    setEditingId(null);
    setName('');
    setCategory(CATEGORIES[0]);
    setRate('100');
    setIsActive(true);
    setFormError('');
    setOpen(true);
  }

  function openEdit(row: ActivityRow) {
    setEditingId(String(row.id));
    setName(asCaption(row.activity_name));
    setCategory(asCaption(row.activity_category) || CATEGORIES[0]);
    setRate(String(row.default_hourly_expense ?? 0));
    setIsActive(row.is_active !== false);
    setFormError('');
    setOpen(true);
  }

  async function onSave() {
    setFormError('');
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      if (editingId) {
        await updateActivity({
          id: editingId,
          body: {
            activity_name: name.trim(),
            activity_category: category,
            default_hourly_expense: Number(rate) || 0,
            is_active: isActive,
          },
        }).unwrap();
      } else {
        await createActivity({
          activity_name: name.trim(),
          activity_category: category,
          default_hourly_expense: Number(rate) || 0,
        }).unwrap();
      }
      setOpen(false);
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Production"
        title="Activities"
        count={`${data.length} ${data.length === 1 ? 'activity' : 'activities'}`}
        actions={
          <Button type="button" onClick={openCreate}>
            Add activity
          </Button>
        }
      />
      {isLoading ? <EntityListLoading>Loading…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load production activities.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No production activities yet.</strong>
        </EntityListEmpty>
      ) : null}
      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onEditRow={(row) => openEdit(row)}
          onNew={openCreate}
          actions={(row) => (
            <EntityListActions
              onEdit={() => openEdit(row)}
              onDelete={() => void deactivate(String(row.id)).then(() => refetch())}
            />
          )}
        />
      ) : null}
      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListFoot>
          <div className="el-foot-pager">
            <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPage={setPage} />
          </div>
        </EntityListFoot>
      ) : null}
      <Modal
        open={open}
        title={editingId ? 'Edit activity' : 'Add activity'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Default hourly expense">
            <TextInput value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

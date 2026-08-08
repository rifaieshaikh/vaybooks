import { useMemo, useState } from 'react';
import {
  useCreateStoreActivityMutation,
  useDeactivateStoreActivityMutation,
  useListStoreActivitiesQuery,
} from '@vaybooks/store';
import {
  Button,
  EntityCard,
  EntityCardGrid,
  ErrorText,
  FormRow,
  ListToolbar,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const CATEGORIES = [
  'In House Service',
  'In House Material',
  'Outsourced Service',
  'Outsourced Material',
];

const DEFAULT_FILTERS = { activity_name: '', activity_category: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'activity_name', desc: false }];

export function StoreActivitiesPage() {
  const { data = [], isLoading, error, refetch } = useListStoreActivitiesQuery({
    active_only: false,
  });
  const [createActivity, createState] = useCreateStoreActivityMutation();
  const [deactivate] = useDeactivateStoreActivityMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [rate, setRate] = useState('100');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'activity_name', label: 'Name', type: 'text' },
      { key: 'activity_category', label: 'Category', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.activity_name, filters.activity_name)) return false;
      if (!matchesRegex(row.activity_category, filters.activity_category)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    if (!name.trim()) {
      setFormError('Activity name is required');
      return;
    }
    try {
      await createActivity({
        activity_name: name.trim(),
        activity_category: category,
        default_hourly_expense: Number(rate) || 0,
      }).unwrap();
      setOpen(false);
      setName('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <ListToolbar
        title="Store Activities"
        countLabel="activities"
        count={filtered.length}
        primaryLabel="New activity"
        onPrimary={() => {
          setFormError('');
          setOpen(true);
        }}
        filterFields={filterFields}
        filters={filters}
        defaultFilters={DEFAULT_FILTERS}
        onFiltersChange={(next) => {
          setFilters(next as typeof DEFAULT_FILTERS);
          setPage(1);
        }}
        sort={sort}
        defaultSort={DEFAULT_SORT}
        sortOptions={[
          { value: 'activity_name', label: 'Name' },
          { value: 'activity_category', label: 'Category' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load store activities.</ErrorText> : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <p style={{ color: '#667' }}>No store activities yet.</p>
      ) : (
        <EntityCardGrid>
          {pageRows.map((row) => (
            <EntityCard
              key={String(row.id)}
              title={asCaption(row.activity_name) || String(row.id)}
              captions={[
                asCaption(row.activity_category),
                row.is_active === false ? 'Inactive' : 'Active',
                `₹${Number(row.default_hourly_expense ?? 0)}/hr`,
              ]}
              onEdit={
                row.is_active === false
                  ? undefined
                  : () => {
                      if (window.confirm('Deactivate this activity?')) {
                        void deactivate(String(row.id)).then(() => refetch());
                      }
                    }
              }
            />
          ))}
        </EntityCardGrid>
      )}
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPageChange={setPage} />

      <Modal
        open={open}
        title="New store activity"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onCreate()} disabled={createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Create'}
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
    </div>
  );
}

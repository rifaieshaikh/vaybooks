import { useMemo, useState } from 'react';
import {
  useCreateRecipeMutation,
  useListInventoryProductsQuery,
  useListRecipesQuery,
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

const DEFAULT_FILTERS = { name: '', code: '' };
const DEFAULT_SORT: SortCriterion[] = [{ key: 'name', desc: false }];

export function ProductionRecipesPage() {
  const { data = [], isLoading, error, refetch } = useListRecipesQuery();
  const { data: products = [] } = useListInventoryProductsQuery();
  const [createRecipe, createState] = useCreateRecipeMutation();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'code', label: 'Code', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const rows = data.filter((row) => {
      if (!matchesRegex(row.name, filters.name)) return false;
      if (!matchesRegex(row.code, filters.code)) return false;
      return true;
    });
    return sortRows(rows, sort);
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  async function onCreate() {
    setFormError('');
    if (!name.trim() || !inputId || !outputId) {
      setFormError('Name, input product, and output product are required');
      return;
    }
    try {
      await createRecipe({
        name: name.trim(),
        code: code.trim(),
        base_quantity: 1,
        inputs: [{ product_id: inputId, qty: 1 }],
        outputs: [{ product_id: outputId, expected_qty: 1, role: 'Main' }],
      }).unwrap();
      setOpen(false);
      setName('');
      setCode('');
      refetch();
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <div>
      <ListToolbar
        title="Recipes"
        countLabel="recipes"
        count={filtered.length}
        primaryLabel="New recipe"
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
          { value: 'name', label: 'Name' },
          { value: 'code', label: 'Code' },
        ]}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load recipes.</ErrorText> : null}
      <EntityCardGrid>
        {pageRows.map((row) => (
          <EntityCard
            key={String(row.id)}
            title={asCaption(row.name) || String(row.id)}
            captions={[
              asCaption(row.code),
              `Base qty ${Number(row.base_quantity ?? 1)}`,
              row.is_active === false ? 'Inactive' : 'Active',
            ]}
          />
        ))}
      </EntityCardGrid>
      <PaginationBar page={Math.min(page, pages)} pageCount={pages} onPageChange={setPage} />

      <Modal
        open={open}
        title="New recipe"
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
          <FormRow label="Code">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
          </FormRow>
          <FormRow label="Input product *">
            <select
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {asCaption(p.name)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Output product *">
            <select
              value={outputId}
              onChange={(e) => setOutputId(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {asCaption(p.name)}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
      </Modal>
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  useCreateMigrationBatchMutation,
  useListMigrationBatchesQuery,
  useListMigrationProfilesQuery,
  useRunMigrationBatchMutation,
} from '@vaybooks/store';
import { Button, DataTable, ErrorText, FormRow, type DataTableColumn } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export function MigrationHubPage() {
  const profilesQ = useListMigrationProfilesQuery();
  const batchesQ = useListMigrationBatchesQuery();
  const [createBatch] = useCreateMigrationBatchMutation();
  const [runBatch] = useRunMigrationBatchMutation();
  const [entity, setEntity] = useState('customers');
  const [source, setSource] = useState('csv');
  const [error, setError] = useState('');

  const profileCols: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'name', header: 'Profile' },
      { key: 'entity_type', header: 'Entity' },
      { key: 'id', header: 'Id' },
    ],
    [],
  );

  const batchCols: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      { key: 'id', header: 'Id' },
      { key: 'entity', header: 'Entity' },
      { key: 'source', header: 'Source' },
      { key: 'status', header: 'Status' },
      { key: 'progress', header: 'Progress' },
    ],
    [],
  );

  async function onCreate() {
    setError('');
    try {
      await createBatch({ source, entity }).unwrap();
      batchesQ.refetch();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onRun(batchId: string) {
    setError('');
    try {
      await runBatch(batchId).unwrap();
      batchesQ.refetch();
    } catch (e) {
      setError(extractError(e));
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Data Migration</h2>
      <p style={{ marginBottom: 20 }}>
        Mapping profiles and import batches. Parse/preview/run APIs support the full wizard flow.
      </p>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <h3 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>Mapping profiles</h3>
      {profilesQ.isLoading && <p>Loading profiles…</p>}
      <DataTable columns={profileCols} rows={(profilesQ.data || []) as Record<string, unknown>[]} />

      <h3 style={{ marginTop: 28, color: 'var(--vb-color-primary, #185c4c)' }}>Import batches</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
        <FormRow label="Entity">
          <select value={entity} onChange={(e) => setEntity(e.target.value)} style={{ padding: 8 }}>
            {['customers', 'vendors', 'products', 'categories', 'leads'].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Source">
          <input value={source} onChange={(e) => setSource(e.target.value)} style={{ padding: 8 }} />
        </FormRow>
        <Button type="button" onClick={onCreate}>
          Queue batch
        </Button>
      </div>
      <DataTable columns={batchCols} rows={(batchesQ.data || []) as Record<string, unknown>[]} />
      {(batchesQ.data || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onRun(String((batchesQ.data || [])[0]?.id || ''))}
          >
            Run latest batch
          </Button>
        </div>
      )}
    </div>
  );
}

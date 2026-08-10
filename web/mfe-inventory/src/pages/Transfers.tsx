import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCancelInventoryTransferMutation,
  useCreateInventoryTransferMutation,
  useDispatchInventoryTransferMutation,
  useGetInventoryTransferQuery,
  useListInventoryLocationsQuery,
  useListInventoryProductsQuery,
  useListInventoryTransfersQuery,
  useReceiveInventoryTransferMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
  EntityListActions,
  EntityListEmpty,
  EntityListFilterSort,
  EntityListFoot,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListQuickFilters,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  PAGE_SIZE,
  PaginationBar,
  StatusPill,
  TextInput,
  matchesRegex,
  pageCount,
  paginate,
  sortRows,
  statusPillTone,
  type EntityListColumn,
  type FilterFieldDef,
  type SortCriterion,
} from '@vaybooks/ui-kit';

type TransferDetailTab = 'overview' | 'lines';

type TransferLineDraft = { product_id: string; qty: string };

const TRANSFER_STATUSES = ['Draft', 'In Transit', 'Received', 'Cancelled'];

function statusLabel(status: unknown): string {
  return String(status || 'Unknown');
}

function statusTone(status: unknown): string | undefined {
  const s = String(status || '');
  if (s === 'Received') return 'el-advance';
  if (s === 'Cancelled') return 'el-due';
  if (s === 'Draft' || s === 'In Transit') return 'el-muted';
  return undefined;
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Action failed');
  }
  return 'Action failed';
}

const DEFAULT_TRANSFER_FILTERS = { transfer_number: '', status: '' };
const DEFAULT_TRANSFER_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

/** Streamlit parity: stock transfer list with status badges + new-transfer wizard modal. */
export function TransfersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListInventoryTransfersQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: true });
  const { data: products = [] } = useListInventoryProductsQuery({ active_only: true });
  const [createTransfer, createState] = useCreateInventoryTransferMutation();

  const [sort, setSort] = useState<SortCriterion[]>(DEFAULT_TRANSFER_SORT);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...DEFAULT_TRANSFER_FILTERS });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [lines, setLines] = useState<TransferLineDraft[]>([{ product_id: '', qty: '1' }]);
  const [sendInTransit, setSendInTransit] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: String(l.id), name: String(l.name || l.id) })),
    [locations],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ id: String(p.id), label: `${String(p.sku || '')} — ${String(p.name || p.id)}` })),
    [products],
  );

  const filterFields: FilterFieldDef[] = useMemo(
    () => [
      { key: 'transfer_number', label: 'Transfer #', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        allLabel: 'All statuses',
        options: TRANSFER_STATUSES.map((s) => ({ value: s, label: s })),
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    let rows = data.filter((row) => {
      if (!matchesRegex(row.transfer_number, filters.transfer_number)) return false;
      if (filters.status && String(row.status || '') !== filters.status) return false;
      return true;
    });
    rows = sortRows(rows, sort);
    return rows;
  }, [data, filters, sort]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  type TransferRow = (typeof data)[number];

  function openNew() {
    setFormError('');
    setFromLocationId(locationOptions[0]?.id || '');
    setToLocationId(locationOptions[1]?.id || locationOptions[0]?.id || '');
    setLines([{ product_id: productOptions[0]?.id || '', qty: '1' }]);
    setSendInTransit(false);
    setNotes('');
    setDialogOpen(true);
  }

  function updateLine(index: number, patch: Partial<TransferLineDraft>) {
    setLines((prev) => prev.map((ln, i) => (i === index ? { ...ln, ...patch } : ln)));
  }

  function addLine() {
    setLines((prev) => [...prev, { product_id: productOptions[0]?.id || '', qty: '1' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submitTransfer() {
    setFormError('');
    if (!fromLocationId || !toLocationId) {
      setFormError('Choose both source and destination locations');
      return;
    }
    if (fromLocationId === toLocationId) {
      setFormError('Source and destination must be different');
      return;
    }
    const cleanLines = lines
      .filter((ln) => ln.product_id && Number(ln.qty) > 0)
      .map((ln) => ({ product_id: ln.product_id, qty: Number(ln.qty) }));
    if (cleanLines.length === 0) {
      setFormError('Add at least one line with a product and quantity');
      return;
    }
    try {
      await createTransfer({
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        lines: cleanLines,
        notes,
        send_in_transit: sendInTransit,
      }).unwrap();
      setDialogOpen(false);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
    }
  }

  const columns: EntityListColumn<TransferRow>[] = useMemo(
    () => [
      {
        id: 'transfer',
        header: 'Transfer',
        render: (row) => {
          const number = String(row.transfer_number || row.id);
          const from = String(row.from_location_name || row.from_location_id || '—');
          const to = String(row.to_location_name || row.to_location_id || '—');
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">
                  {from} → {to}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'lines',
        header: 'Lines',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const lineCount = Array.isArray(row.lines) ? (row.lines as unknown[]).length : 0;
          return lineCount;
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => <span className={statusTone(row.status)}>{statusLabel(row.status)}</span>,
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Stock Transfers"
        count={`${filtered.length} ${filtered.length === 1 ? 'transfer' : 'transfers'}`}
        actions={
          <Button type="button" onClick={openNew}>
            New Transfer
          </Button>
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters((prev) => ({ ...prev, status: id === 'all' ? '' : id }));
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              ...TRANSFER_STATUSES.map((s) => ({ id: s, label: s })),
            ]}
          />
        }
        tools={
          <EntityListFilterSort
            filterFields={filterFields}
            filters={filters}
            defaultFilters={DEFAULT_TRANSFER_FILTERS}
            excludeKeys={['status']}
            onFiltersChange={(next) => {
              setFilters(next as typeof filters);
              setPage(1);
            }}
            sort={sort}
            defaultSort={DEFAULT_TRANSFER_SORT}
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'transfer_number', label: 'Transfer #' },
              { value: 'status', label: 'Status' },
            ]}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading transfers…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load transfers. Is the API running?</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>No transfers found.</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/inventory/transfers/${String(row.id)}`)}
          onNew={openNew}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/inventory/transfers/${String(row.id)}`)} />
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
        title="New Transfer"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => void submitTransfer()} disabled={createState.isLoading}>
              Create Transfer
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormRow label="From location *">
              <select
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
              >
                <option value="">— Choose —</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="To location *">
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
              >
                <option value="">— Choose —</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          <div style={{ fontWeight: 650 }}>Lines</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'end' }}>
                <FormRow label={i === 0 ? 'Product' : ''}>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(i, { product_id: e.target.value })}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
                  >
                    <option value="">— Choose —</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label={i === 0 ? 'Qty' : ''}>
                  <TextInput type="number" value={line.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
                </FormRow>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 1}
                  title="Remove line"
                  style={{
                    height: 34,
                    marginBottom: 2,
                    border: '1px solid #c5d4ce',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={addLine}>
              Add line
            </Button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={sendInTransit} onChange={(e) => setSendInTransit(e.target.checked)} />
            Dispatch immediately (mark In Transit)
          </label>

          <FormRow label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

/** Streamlit parity: transfer detail with lifecycle actions (dispatch / receive / cancel). */
export function TransferDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetInventoryTransferQuery(id, { skip: !id });
  const [dispatchTransfer, dispatchState] = useDispatchInventoryTransferMutation();
  const [receiveTransfer, receiveState] = useReceiveInventoryTransferMutation();
  const [cancelTransfer, cancelState] = useCancelInventoryTransferMutation();
  const [actionError, setActionError] = useState('');
  const [tab, setTab] = useState<TransferDetailTab>('overview');

  async function run(action: () => Promise<unknown>) {
    setActionError('');
    try {
      await action();
      refetch();
    } catch (e: unknown) {
      setActionError(extractError(e));
    }
  }

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading transfer…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/inventory/transfers" label="Transfers" />
        <ErrorText>Transfer not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const status = String(data.status || '');
  const lines = Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : [];
  const label = statusLabel(status);
  const fromLabel = String(data.from_location_name || data.from_location_id || '—');
  const toLabel = String(data.to_location_name || data.to_location_id || '—');
  const busy = dispatchState.isLoading || receiveState.isLoading || cancelState.isLoading;

  const heroActions = (
    <>
      <Button type="button" variant="ghost" onClick={() => void refetch()} disabled={busy}>
        Refresh
      </Button>
      {status === 'Draft' ? (
        <Button
          type="button"
          disabled={dispatchState.isLoading}
          onClick={() => void run(() => dispatchTransfer(id).unwrap())}
        >
          Dispatch
        </Button>
      ) : null}
      {status === 'In Transit' || status === 'Draft' ? (
        <Button
          type="button"
          disabled={receiveState.isLoading}
          onClick={() => void run(() => receiveTransfer(id).unwrap())}
        >
          Receive
        </Button>
      ) : null}
      {status !== 'Received' && status !== 'Cancelled' ? (
        <Button
          type="button"
          variant="ghost"
          disabled={cancelState.isLoading}
          onClick={() => void run(() => cancelTransfer(id).unwrap())}
        >
          Cancel
        </Button>
      ) : null}
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/inventory/transfers" label="Transfers" />

      <EntityDetailHero
        kicker="Inventory · Transfer"
        title={String(data.transfer_number || id)}
        lead={
          <>
            <StatusPill status={label} tone={statusPillTone(status)} />
            <span className="ed-lead-sep">
              {' '}
              · {fromLabel} → {toLabel}
            </span>
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Transfer facts"
        items={[
          { label: 'Status', value: label },
          { label: 'From', value: fromLabel },
          { label: 'To', value: toLabel },
          { label: 'Date', value: String(data.transfer_date || '—') },
          { label: 'Lines', value: lines.length },
        ]}
      />

      {actionError ? <ErrorText>{actionError}</ErrorText> : null}

      <EntityDetailTabs
        value={tab}
        ariaLabel="Transfer sections"
        onChange={(next) => setTab(next as TransferDetailTab)}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'lines', label: `Lines (${lines.length})` },
        ]}
      />

      {tab === 'overview' ? (
        <EntityDetailPanel title="Overview" note="Route and notes for this stock transfer.">
          <div className="ed-grid ed-grid-2">
            <FormRow label="From location">
              <TextInput value={fromLabel} disabled />
            </FormRow>
            <FormRow label="To location">
              <TextInput value={toLabel} disabled />
            </FormRow>
            <FormRow label="Transfer date">
              <TextInput value={String(data.transfer_date || '')} disabled />
            </FormRow>
            <FormRow label="Status">
              <TextInput value={label} disabled />
            </FormRow>
          </div>
          <FormRow label="Notes">
            <TextInput value={String(data.notes || '')} disabled />
          </FormRow>
        </EntityDetailPanel>
      ) : null}

      {tab === 'lines' ? (
        <EntityDetailPanel title="Lines" note="Products and quantities on this transfer.">
          {lines.length === 0 ? (
            <p className="ed-panel-note">No lines</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid var(--ed-primary, #185c4c)', padding: '0.5rem' }}>
                    Product
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid var(--ed-primary, #185c4c)', padding: '0.5rem' }}>
                    Qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={String(line.id || line.product_id)}>
                    <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                      {String(line.product_name || line.product_id)}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{Number(line.qty ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/inventory/transfers')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}

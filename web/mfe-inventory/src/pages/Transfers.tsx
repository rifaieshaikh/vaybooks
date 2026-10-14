import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCancelInventoryTransferMutation,
  useCreateInventoryTransferMutation,
  useDispatchInventoryTransferMutation,
  useGetInventoryTransferQuery,
  useListInventoryLocationsQuery,
  useListInventorySkusQuery,
  useListInventoryTransfersQuery,
  useReceiveInventoryTransferMutation,
} from '@vaybooks/store';
import {
  Button,
  ConfirmDialog,
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
  ModalForm,
  ModalFormActions,
  PAGE_SIZE,
  PaginationBar,
  SearchableSelect,
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
import { toLocationOptions, toProductOptions } from '../pickerOptions';
import {
  getTransferConfirm,
  type TransferConfirmAction,
} from '../transferConfirm';

type TransferDetailTab = 'overview' | 'lines';

type TransferLineDraft = { product_id: string; qty: string };

const TRANSFER_STATUSES = ['Draft', 'In Transit', 'Received', 'Cancelled'];

function statusLabel(status: unknown): string {
  return String(status || 'Unknown');
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Action failed');
  }
  return 'Action failed';
}

const DEFAULT_TRANSFER_FILTERS = { transfer_number: '', status: '' };
const DEFAULT_TRANSFER_SORT: SortCriterion[] = [{ key: 'created_at', desc: true }];

/** Stock transfer list with status badges + new-transfer modal. */
export function TransfersListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListInventoryTransfersQuery();
  const { data: locations = [] } = useListInventoryLocationsQuery({ active_only: true });
  const { data: products = [] } = useListInventorySkusQuery({ active_only: true });
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
  const [pendingConfirm, setPendingConfirm] = useState<TransferConfirmAction | null>(null);

  const locationOptions = useMemo(
    () => toLocationOptions(locations as Record<string, unknown>[]),
    [locations],
  );
  const productOptions = useMemo(
    () => toProductOptions(products as Record<string, unknown>[]),
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
    setFromLocationId(locationOptions[0]?.value || '');
    setToLocationId(locationOptions[1]?.value || locationOptions[0]?.value || '');
    setLines([{ product_id: productOptions[0]?.value || '', qty: '1' }]);
    setSendInTransit(false);
    setNotes('');
    setPendingConfirm(null);
    setDialogOpen(true);
  }

  function updateLine(index: number, patch: Partial<TransferLineDraft>) {
    setLines((prev) => prev.map((ln, i) => (i === index ? { ...ln, ...patch } : ln)));
  }

  function addLine() {
    setLines((prev) => [...prev, { product_id: productOptions[0]?.value || '', qty: '1' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validateTransfer(): boolean {
    setFormError('');
    if (!fromLocationId || !toLocationId) {
      setFormError('Choose both source and destination locations');
      return false;
    }
    if (fromLocationId === toLocationId) {
      setFormError('Source and destination must be different');
      return false;
    }
    const cleanLines = lines.filter((ln) => ln.product_id && Number(ln.qty) > 0);
    if (cleanLines.length === 0) {
      setFormError('Add at least one line with a product and quantity');
      return false;
    }
    return true;
  }

  async function createNow() {
    const cleanLines = lines
      .filter((ln) => ln.product_id && Number(ln.qty) > 0)
      .map((ln) => ({ product_id: ln.product_id, sku_id: ln.product_id, qty: Number(ln.qty) }));
    try {
      await createTransfer({
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        lines: cleanLines,
        notes,
        send_in_transit: sendInTransit,
      }).unwrap();
      setPendingConfirm(null);
      setDialogOpen(false);
      refetch();
    } catch (e: unknown) {
      setFormError(extractError(e));
      setPendingConfirm(null);
    }
  }

  async function submitTransfer() {
    if (!validateTransfer()) return;
    if (sendInTransit) {
      setPendingConfirm('create-dispatch');
      return;
    }
    await createNow();
  }

  const createConfirm = pendingConfirm ? getTransferConfirm(pendingConfirm) : null;

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
        render: (row) => {
          const s = statusLabel(row.status);
          return <StatusPill status={s} tone={statusPillTone(s)} />;
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Inventory"
        title="Transfers"
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

      <Modal title="New Transfer" open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <ModalForm onSubmit={() => void submitTransfer()}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormRow label="From location *">
                <SearchableSelect
                  options={locationOptions}
                  value={fromLocationId}
                  placeholder="Choose source"
                  onChange={setFromLocationId}
                />
              </FormRow>
              <FormRow label="To location *">
                <SearchableSelect
                  options={locationOptions}
                  value={toLocationId}
                  placeholder="Choose destination"
                  onChange={setToLocationId}
                />
              </FormRow>
            </div>

            <div style={{ fontWeight: 650 }}>Lines</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {lines.map((line, i) => (
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'end' }}
                >
                  <FormRow label={i === 0 ? 'Product' : ''}>
                    <SearchableSelect
                      options={productOptions}
                      value={line.product_id}
                      placeholder="Choose product"
                      onChange={(next) => updateLine(i, { product_id: next })}
                    />
                  </FormRow>
                  <FormRow label={i === 0 ? 'Qty' : ''}>
                    <TextInput
                      type="number"
                      value={line.qty}
                      onChange={(e) => updateLine(i, { qty: e.target.value })}
                    />
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
              <input
                type="checkbox"
                checked={sendInTransit}
                onChange={(e) => setSendInTransit(e.target.checked)}
              />
              Dispatch immediately (mark In Transit)
            </label>

            <FormRow label="Notes">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormRow>
          </div>
          <ModalFormActions
            busy={createState.isLoading}
            submitLabel="Create Transfer"
            busyLabel="Creating…"
            onCancel={() => setDialogOpen(false)}
          />
        </ModalForm>
      </Modal>

      <ConfirmDialog
        open={pendingConfirm === 'create-dispatch'}
        title={createConfirm?.title || ''}
        message={createConfirm?.message || ''}
        confirmLabel={createConfirm?.confirmLabel || 'Confirm'}
        danger={createConfirm?.danger}
        busy={createState.isLoading}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => void createNow()}
      />
    </EntityListPage>
  );
}

/** Transfer detail with lifecycle actions (dispatch / receive / cancel). */
export function TransferDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetInventoryTransferQuery(id, { skip: !id });
  const [dispatchTransfer, dispatchState] = useDispatchInventoryTransferMutation();
  const [receiveTransfer, receiveState] = useReceiveInventoryTransferMutation();
  const [cancelTransfer, cancelState] = useCancelInventoryTransferMutation();
  const [actionError, setActionError] = useState('');
  const [tab, setTab] = useState<TransferDetailTab>('overview');
  const [pendingAction, setPendingAction] = useState<TransferConfirmAction | null>(null);

  async function run(action: () => Promise<unknown>) {
    setActionError('');
    try {
      await action();
      setPendingAction(null);
      refetch();
    } catch (e: unknown) {
      setActionError(extractError(e));
      setPendingAction(null);
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
  const confirmCfg = pendingAction ? getTransferConfirm(pendingAction) : null;

  const heroActions = (
    <>
      <Button type="button" variant="ghost" onClick={() => void refetch()} disabled={busy}>
        Refresh
      </Button>
      {status === 'Draft' ? (
        <Button type="button" disabled={dispatchState.isLoading} onClick={() => setPendingAction('dispatch')}>
          Dispatch
        </Button>
      ) : null}
      {status === 'In Transit' || status === 'Draft' ? (
        <Button type="button" disabled={receiveState.isLoading} onClick={() => setPendingAction('receive')}>
          Receive
        </Button>
      ) : null}
      {status !== 'Received' && status !== 'Cancelled' ? (
        <Button type="button" variant="ghost" disabled={cancelState.isLoading} onClick={() => setPendingAction('cancel')}>
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmCfg?.title || ''}
        message={confirmCfg?.message || ''}
        confirmLabel={confirmCfg?.confirmLabel || 'Confirm'}
        danger={confirmCfg?.danger}
        busy={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction === 'dispatch') void run(() => dispatchTransfer(id).unwrap());
          else if (pendingAction === 'receive') void run(() => receiveTransfer(id).unwrap());
          else if (pendingAction === 'cancel') void run(() => cancelTransfer(id).unwrap());
        }}
      />
    </EntityDetailPage>
  );
}

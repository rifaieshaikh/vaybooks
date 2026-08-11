import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useCreateProjectEnquiryMutation,
  useGetProjectEnquiryQuery,
  useListCustomersQuery,
  useListProjectEnquiriesQuery,
  useMarkProjectEnquiryWonMutation,
  useStartProjectEnquiryEstimationMutation,
  useUpdateProjectEnquiryStatusMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityListActions,
  EntityListEmpty,
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
  displayName,
  matchesRegex,
  pageCount,
  paginate,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../utils';

const ENQUIRY_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Submitted', label: 'Submitted' },
  { id: 'Estimating', label: 'Estimating' },
  { id: 'Quoted', label: 'Quoted' },
  { id: 'Won', label: 'Won' },
  { id: 'Lost', label: 'Lost' },
] as const;

const ENQUIRY_STATUS_OPTIONS = ENQUIRY_STATUS_CHIPS.filter((s) => s.id !== 'all').map((s) => s.id);

export function ProjectEnquiriesListPage() {
  const navigate = useNavigate();
  const [params, setSearchParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useListProjectEnquiriesQuery();
  const { data: customers = [] } = useListCustomersQuery();
  const [createEnquiry, createState] = useCreateProjectEnquiryMutation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(() => params.get('customer_id') || '');
  const [requirement, setRequirement] = useState('');
  const [formError, setFormError] = useState('');

  type EnquiryRow = (typeof data)[number];

  useEffect(() => {
    const cid = params.get('customer_id') || '';
    if (cid) setCustomerId(cid);
    if (params.get('new') !== '1') return;
    setFormError('');
    setRequirement('');
    setOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [params, setSearchParams]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.enquiry_number, search) ||
        matchesRegex(row.customer_name, search) ||
        matchesRegex(row.status, search) ||
        matchesRegex(row.requirement, search)
      );
    });
  }, [data, filters, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const columns: EntityListColumn<EnquiryRow>[] = useMemo(
    () => [
      {
        id: 'enquiry',
        header: 'Enquiry',
        render: (row) => {
          const number = displayName(row, ['enquiry_number'], String(row.id));
          const customer = asCaption(row.customer_name);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{customer}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        render: (row) => asCaption(row.status),
      },
      {
        id: 'requirement',
        header: 'Requirement',
        render: (row) => {
          const text = String(row.requirement || '').trim();
          return <span className={text ? undefined : 'el-muted'}>{text || '—'}</span>;
        },
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setCustomerId(params.get('customer_id') || customerId || '');
    setRequirement('');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createEnquiry({
        customer_id: customerId,
        requirement,
      }).unwrap();
      setOpen(false);
      navigate(`/projects/enquiries/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="Projects"
        title="Project Enquiries"
        count={`${filtered.length} ${filtered.length === 1 ? 'enquiry' : 'enquiries'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={openCreate}>
              New enquiry
            </Button>
          </>
        }
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search customer, status, requirement…"
            aria-label="Search project enquiries"
          />
        }
        chips={
          <EntityListQuickFilters
            ariaLabel="Status"
            value={filters.status || 'all'}
            onChange={(id) => {
              setFilters({ status: id === 'all' ? '' : id });
              setPage(1);
            }}
            options={[...ENQUIRY_STATUS_CHIPS]}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading enquiries…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load enquiries.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || filters.status ? 'No matching enquiries' : 'No enquiries yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          keyboardNav
          onActivateRow={(row) => navigate(`/projects/enquiries/${row.id}`)}
          onNew={openCreate}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/projects/enquiries/${row.id}`)} />
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
        title="New enquiry"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={!customerId || createState.isLoading}
            >
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Customer">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ width: '100%', minWidth: 200 }}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.customer_name || c.name || c.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Requirement">
            <input value={requirement} onChange={(e) => setRequirement(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function ProjectEnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetProjectEnquiryQuery(id, { skip: !id });
  const [updateStatus, updateState] = useUpdateProjectEnquiryStatusMutation();
  const [startEstimation, estimateState] = useStartProjectEnquiryEstimationMutation();
  const [markWon, wonState] = useMarkProjectEnquiryWonMutation();
  const [actionError, setActionError] = useState('');
  const [status, setStatus] = useState('');

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading enquiry…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/projects/enquiries" label="Enquiries" />
        <ErrorText>Enquiry not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const currentStatus = status || String(data.status || '');
  const statusChoices = ENQUIRY_STATUS_OPTIONS.includes(currentStatus as (typeof ENQUIRY_STATUS_OPTIONS)[number])
    ? ENQUIRY_STATUS_OPTIONS
    : currentStatus
      ? [currentStatus, ...ENQUIRY_STATUS_OPTIONS]
      : ENQUIRY_STATUS_OPTIONS;

  async function run(fn: () => Promise<unknown>) {
    setActionError('');
    try {
      const result = await fn();
      await refetch();
      return result;
    } catch (e) {
      setActionError(extractError(e));
    }
  }

  const heroActions = (
    <>
      <Button
        type="button"
        onClick={async () => {
          const project = await run(() => startEstimation(id).unwrap());
          if (project && typeof project === 'object' && 'id' in project) {
            navigate(`/projects/list/${String((project as { id: string }).id)}`);
          }
        }}
        disabled={estimateState.isLoading}
      >
        {estimateState.isLoading ? 'Starting…' : 'Start estimation'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => void run(() => markWon(id).unwrap())}
        disabled={wonState.isLoading}
      >
        {wonState.isLoading ? 'Saving…' : 'Mark won'}
      </Button>
    </>
  );

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/projects/enquiries" label="Enquiries" />

      <EntityDetailHero
        kicker="Projects · Enquiry"
        title={asCaption(data.enquiry_number)}
        lead={
          <>
            {asCaption(data.customer_name) || 'No customer'}
            {data.status ? <span className="ed-lead-sep"> · {asCaption(data.status)}</span> : null}
          </>
        }
        actions={heroActions}
      />

      <EntityDetailSnapshot
        ariaLabel="Enquiry facts"
        items={[
          { label: 'Customer', value: asCaption(data.customer_name) || '—' },
          { label: 'Status', value: asCaption(data.status) || '—' },
          { label: 'Requirement', value: asCaption(data.requirement) || '—' },
        ]}
      />

      {actionError ? <ErrorText>{actionError}</ErrorText> : null}

      <EntityDetailPanel title="Details">
        <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          <FormRow label="Requirement">
            <p style={{ margin: 0 }}>{asCaption(data.requirement) || '—'}</p>
          </FormRow>
          <FormRow label="Status">
            <select
              value={currentStatus}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: '100%', minWidth: 200 }}
            >
              {!currentStatus ? <option value="">Select…</option> : null}
              {statusChoices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormRow>
          <div>
            <Button
              type="button"
              onClick={() =>
                void run(() =>
                  updateStatus({
                    id,
                    status: currentStatus || String(data.status || 'Open'),
                  }).unwrap(),
                )
              }
              disabled={updateState.isLoading || !currentStatus}
            >
              {updateState.isLoading ? 'Updating…' : 'Update status'}
            </Button>
          </div>
        </div>
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/projects/enquiries')}>
            Back to list
          </Button>
        }
        end={heroActions}
      />
    </EntityDetailPage>
  );
}

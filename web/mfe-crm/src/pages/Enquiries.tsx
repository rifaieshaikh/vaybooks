import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateCrmEnquiryMutation,
  useGetCrmEnquiryQuery,
  useListCrmEnquiriesQuery,
  useListCrmLeadsQuery,
  useUpdateCrmEnquiryMutation,
} from '@vaybooks/store';
import {
  Button,
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
  { id: 'Open', label: 'Open' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Won', label: 'Won' },
  { id: 'Lost', label: 'Lost' },
  { id: 'Closed', label: 'Closed' },
] as const;

export function CrmEnquiriesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCrmEnquiriesQuery();
  const { data: leads = [] } = useListCrmLeadsQuery();
  const [createEnquiry, createState] = useCreateCrmEnquiryMutation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  type EnquiryRow = (typeof data)[number];

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.enquiry_number, search) ||
        matchesRegex(row.party_name, search) ||
        matchesRegex(row.status, search) ||
        matchesRegex(row.product_interest, search)
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
          const party = asCaption(row.party_name);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{number}</span>
                <span className="el-customer-sub">{party}</span>
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
        id: 'interest',
        header: 'Interest',
        render: (row) => {
          const interest = String(row.product_interest || '').trim();
          return <span className={interest ? undefined : 'el-muted'}>{interest || '—'}</span>;
        },
      },
      {
        id: 'value',
        header: 'Value',
        className: 'el-num',
        headerClassName: 'el-col-num',
        render: (row) => {
          const value = row.estimated_value;
          if (value == null || value === '') return <span className="el-muted">—</span>;
          return asCaption(value);
        },
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setLeadId('');
    setDescription('');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createEnquiry({
        lead_id: leadId,
        description,
        product_interest: description,
      }).unwrap();
      setOpen(false);
      navigate(`/crm/enquiries/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Enquiries"
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
            placeholder="Search party, status, interest…"
            aria-label="Search enquiries"
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
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/crm/enquiries/${row.id}`)} />
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
            <Button type="button" onClick={() => void onCreate()} disabled={!leadId || createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {formError ? <ErrorText>{formError}</ErrorText> : null}
          <FormRow label="Lead">
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={{ width: '100%', minWidth: 200 }}>
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {String(l.name || l.lead_number || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Interest / notes">
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function CrmEnquiryDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmEnquiryQuery(id, { skip: !id });
  const [updateEnquiry, updateState] = useUpdateCrmEnquiryMutation();
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function onSave() {
    setMsg('');
    try {
      await updateEnquiry({ id, body: { notes } }).unwrap();
      setMsg('Saved');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Enquiry not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/crm/enquiries">← Enquiries</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.enquiry_number)}</h2>
      <p>
        {asCaption(data.party_name)} · {asCaption(data.status)}
      </p>
      <FormRow label="Notes">
        <textarea
          value={notes || String(data.notes || '')}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ width: '100%', maxWidth: 480 }}
        />
      </FormRow>
      <Button type="button" onClick={onSave} disabled={updateState.isLoading}>
        Save
      </Button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}

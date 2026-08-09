import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateCrmActivityMutation,
  useGetCrmActivityQuery,
  useListCrmActivitiesQuery,
  useListCrmLeadsQuery,
  useUpdateCrmActivityMutation,
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

const ACTIVITY_TYPES = ['Called', 'Meeting', 'General Follow-up', 'WhatsApp Message', 'Email', 'Note'];

const ACTIVITY_STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
] as const;

export function CrmActivitiesListPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useListCrmActivitiesQuery();
  const { data: leads = [] } = useListCrmLeadsQuery();
  const [createActivity, createState] = useCreateCrmActivityMutation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [activityType, setActivityType] = useState('Called');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('loc-main');
  const [formError, setFormError] = useState('');

  type ActivityRow = (typeof data)[number];

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (filters.status && String(row.status || '') !== filters.status) return false;
      if (!search.trim()) return true;
      return (
        matchesRegex(row.activity_type, search) ||
        matchesRegex(row.party_name, search) ||
        matchesRegex(row.status, search) ||
        matchesRegex(row.notes, search)
      );
    });
  }, [data, filters, search]);

  const pages = pageCount(filtered.length, PAGE_SIZE);
  const pageRows = paginate(filtered, Math.min(page, pages), PAGE_SIZE);

  const columns: EntityListColumn<ActivityRow>[] = useMemo(
    () => [
      {
        id: 'activity',
        header: 'Activity',
        render: (row) => {
          const type = displayName(row, ['activity_type'], 'Activity');
          const party = asCaption(row.party_name);
          return (
            <div className="el-customer">
              <div className="el-customer-meta">
                <span className="el-customer-name">{type}</span>
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
        id: 'scheduled',
        header: 'Scheduled',
        render: (row) => {
          const scheduled = String(row.scheduled_at || '').trim();
          return <span className={scheduled ? undefined : 'el-muted'}>{scheduled || '—'}</span>;
        },
      },
      {
        id: 'notes',
        header: 'Notes',
        render: (row) => {
          const text = String(row.notes || '').trim();
          return <span className={text ? undefined : 'el-muted'}>{text || '—'}</span>;
        },
      },
    ],
    [],
  );

  function openCreate() {
    setFormError('');
    setLeadId('');
    setActivityType('Called');
    setNotes('');
    setLocationId('loc-main');
    setOpen(true);
  }

  async function onCreate() {
    setFormError('');
    try {
      const row = await createActivity({
        activity_type: activityType,
        lead_id: leadId,
        notes,
        location_id: locationId,
      }).unwrap();
      setOpen(false);
      navigate(`/crm/activities/${row.id}`);
    } catch (e) {
      setFormError(extractError(e));
    }
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Activities"
        count={`${filtered.length} ${filtered.length === 1 ? 'activity' : 'activities'}`}
        actions={
          <>
            <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
              Refresh
            </button>
            <Button type="button" onClick={openCreate}>
              Log activity
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
            placeholder="Search type, party, notes…"
            aria-label="Search activities"
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
            options={[...ACTIVITY_STATUS_CHIPS]}
          />
        }
      />

      {isLoading ? <EntityListLoading>Loading activities…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load activities.</ErrorText> : null}
      {!isLoading && !error && pageRows.length === 0 ? (
        <EntityListEmpty>
          <strong>{search.trim() || filters.status ? 'No matching activities' : 'No activities yet'}</strong>
        </EntityListEmpty>
      ) : null}

      {!isLoading && !error && pageRows.length > 0 ? (
        <EntityListTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => String(row.id)}
          actions={(row) => (
            <EntityListActions onOpen={() => navigate(`/crm/activities/${row.id}`)} />
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
        title="Log activity"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onCreate()} disabled={!leadId || createState.isLoading}>
              {createState.isLoading ? 'Saving…' : 'Log activity'}
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
                  {String(l.name || l.id)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Type">
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={{ width: '100%' }}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
          <FormRow label="Location">
            <input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
          </FormRow>
        </div>
      </Modal>
    </EntityListPage>
  );
}

export function CrmActivityDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCrmActivityQuery(id, { skip: !id });
  const [updateActivity, updateState] = useUpdateCrmActivityMutation();
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function onComplete() {
    setMsg('');
    try {
      await updateActivity({ id, body: { status: 'Completed', notes: notes || undefined } }).unwrap();
      setMsg('Completed');
      refetch();
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <ErrorText>Activity not found.</ErrorText>;

  return (
    <div>
      <p>
        <Link to="/crm/activities">← Activities</Link>
      </p>
      <h2 style={{ color: 'var(--vb-color-primary, #185c4c)' }}>{asCaption(data.activity_type)}</h2>
      <p>
        {asCaption(data.status)} · {asCaption(data.scheduled_at)}
      </p>
      <FormRow label="Notes">
        <textarea
          value={notes || String(data.notes || '')}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ width: '100%', maxWidth: 480 }}
        />
      </FormRow>
      <Button type="button" onClick={onComplete} disabled={updateState.isLoading}>
        Mark completed
      </Button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}

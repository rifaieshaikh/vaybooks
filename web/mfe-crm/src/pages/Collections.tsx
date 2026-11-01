import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateCrmActivityMutation,
  useGetCrmCollectionsQuery,
  useListCrmOwnersQuery,
  usePreviewCrmWhatsappPaymentReminderMutation,
} from '@vaybooks/store';
import {
  Button,
  Drawer,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListTable,
  ErrorText,
  FormRow,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { SectionForm, WhatsAppButton } from '../components';
import { useCrmCan, useCrmFieldVisibility } from '../hooks';
import { daysPastDue, groupByAgingBucket } from '../collectionsAging';
import { asEntityList, entityCaption, entityId, formatOutstanding } from '../overviewHelpers';
import { asCaption, extractError } from '../utils';

type Row = Record<string, unknown>;

function ownerMatches(row: Row, ownerId: string): boolean {
  if (!ownerId) return true;
  return String(row.assigned_user_id || '') === ownerId;
}

function invoiceHref(row: Row): string | null {
  const invId = entityId(row, 'invoice_id', 'id');
  if (!invId) return null;
  // Prefer sales invoice deep-link; ledger voucher ids also resolve via sales detail when linked.
  return `/sales/invoices/${invId}`;
}

export function CrmCollectionsPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const visibility = useCrmFieldVisibility();
  const collectionsEnabled = visibility.collections;
  const { data, isLoading, error, refetch, isFetching } = useGetCrmCollectionsQuery(undefined, {
    skip: !collectionsEnabled,
  });
  const { data: owners = [] } = useListCrmOwnersQuery(undefined, { skip: !collectionsEnabled });
  const [previewReminder, previewState] = usePreviewCrmWhatsappPaymentReminderMutation();
  const [createActivity, createState] = useCreateCrmActivityMutation();

  const [ownerId, setOwnerId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Row | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const snap = (data || {}) as Record<string, unknown>;
  const balancesRaw = useMemo(() => asEntityList(snap.balances), [snap.balances]);
  const openInvoicesRaw = useMemo(() => asEntityList(snap.open_invoices), [snap.open_invoices]);
  const followUpsRaw = useMemo(() => asEntityList(snap.follow_ups), [snap.follow_ups]);
  const promisesRaw = useMemo(
    () => asEntityList(snap.payment_promises),
    [snap.payment_promises],
  );

  const followUps = useMemo(
    () => followUpsRaw.filter((row) => ownerMatches(row, ownerId)),
    [followUpsRaw, ownerId],
  );
  const promises = useMemo(
    () => promisesRaw.filter((row) => ownerMatches(row, ownerId)),
    [promisesRaw, ownerId],
  );
  const balances = useMemo(() => {
    const hasOwnerField = balancesRaw.some(
      (row) => row.assigned_user_id != null && String(row.assigned_user_id) !== '',
    );
    if (!ownerId || !hasOwnerField) return balancesRaw;
    return balancesRaw.filter((row) => ownerMatches(row, ownerId));
  }, [balancesRaw, ownerId]);

  const openInvoices = useMemo(() => {
    const hasOwnerField = openInvoicesRaw.some(
      (row) => row.assigned_user_id != null && String(row.assigned_user_id) !== '',
    );
    if (!ownerId || !hasOwnerField) return openInvoicesRaw;
    return openInvoicesRaw.filter((row) => ownerMatches(row, ownerId));
  }, [openInvoicesRaw, ownerId]);

  const agingRows = openInvoices.length > 0 ? openInvoices : balances;

  const agingGroups = useMemo(
    () =>
      groupByAgingBucket(agingRows, {
        agingAvailable: Boolean(snap.aging_available),
      }),
    [agingRows, snap.aging_available],
  );
  const hasAging = agingGroups.length > 0 || Boolean(snap.aging_available);

  const showingInvoices = openInvoices.length > 0 && hasAging;
  const canSend = Boolean(snap.can_send_payment_reminders) && can.sendWhatsapp;

  async function openPreview(row: Row) {
    setPreviewError('');
    setSelectedCustomer(row);
    setPreviewPhone(String(row.phone || row.mobile || ''));
    setPreviewText('');
    setPreviewOpen(true);
    try {
      const result = await previewReminder({
        customer_id: entityId(row, 'customer_id', 'id'),
        phone: String(row.phone || row.mobile || ''),
        outstanding_amount:
          Number(row.outstanding_amount ?? row.outstanding_balance ?? row.outstanding ?? row.balance ?? row.amount ?? 0) ||
          undefined,
      }).unwrap();
      setPreviewText(
        String(result.message || result.preview || result.body || result.text || JSON.stringify(result)),
      );
      if (result.phone) setPreviewPhone(String(result.phone));
    } catch (e) {
      setPreviewError(extractError(e));
    }
  }

  async function logCollectionActivity(row: Row, kind: 'follow-up' | 'promise') {
    setActionMsg('');
    const customerId = entityId(row, 'customer_id', 'id');
    if (!customerId) {
      setActionMsg('Customer id is required');
      return;
    }
    const owner = owners.find((o) => o.id === ownerId);
    const invRef = entityCaption(row, 'reference') || entityId(row, 'invoice_id');
    try {
      const activity = await createActivity({
        activity_type: kind === 'promise' ? 'Contacted for Credit' : 'Payment Reminder',
        customer_id: customerId,
        party_name: entityCaption(row, 'customer_name', 'party_name', 'name'),
        outcome: kind === 'promise' ? 'Payment Promised' : '',
        notes:
          kind === 'promise'
            ? invRef
              ? `Logged from collections: payment promise (${invRef})`
              : 'Logged from collections: payment promise'
            : invRef
              ? `Logged from collections: follow-up (${invRef})`
              : 'Logged from collections: follow-up',
        assigned_user_id: ownerId || undefined,
        assigned_user_name: owner?.name || undefined,
        status: 'Scheduled',
      }).unwrap();
      setActionMsg(kind === 'promise' ? 'Promise logged' : 'Follow-up logged');
      const aid = String(activity.id || '');
      if (aid) navigate(`/crm/activities/${aid}`);
      else void refetch();
    } catch (e) {
      setActionMsg(extractError(e));
    }
  }

  const balanceColumns: EntityListColumn<Row>[] = [
    {
      id: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="el-customer">
          <div className="el-customer-meta">
            <span className="el-customer-name">
              {entityCaption(row, 'customer_name', 'party_name', 'name') || '—'}
            </span>
            <span className="el-customer-sub">
              {entityCaption(row, 'phone', 'mobile') || entityId(row, 'customer_id', 'id')}
            </span>
          </div>
        </div>
      ),
    },
    ...(showingInvoices
      ? [
          {
            id: 'invoice',
            header: 'Invoice',
            render: (row: Row) => {
              const label =
                entityCaption(row, 'reference') || entityId(row, 'invoice_id') || '—';
              const href = invoiceHref(row);
              if (!href) return <span>{label}</span>;
              return (
                <Link to={href} onClick={(e) => e.stopPropagation()}>
                  {label}
                </Link>
              );
            },
          } as EntityListColumn<Row>,
        ]
      : []),
    {
      id: 'outstanding',
      header: 'Outstanding',
      className: 'el-num',
      headerClassName: 'el-col-num',
      render: (row) =>
        formatOutstanding(
          row.outstanding_amount ??
            row.outstanding_balance ??
            row.outstanding ??
            row.balance ??
            row.amount,
        ) || '—',
    },
    ...(hasAging
      ? [
          {
            id: 'aging',
            header: 'Days past due',
            render: (row: Row) => {
              const days = daysPastDue(row);
              return days == null ? <span className="el-muted">—</span> : <span>{days}</span>;
            },
          } as EntityListColumn<Row>,
        ]
      : []),
    {
      id: 'actions',
      header: 'Actions',
      render: (row) => {
        const phone = String(row.phone || row.mobile || '');
        const cid = entityId(row, 'customer_id', 'id');
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cid ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/parties/customers/${cid}?tab=crm`)}
              >
                Customer
              </Button>
            ) : null}
            {showingInvoices && invoiceHref(row) ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(invoiceHref(row)!)}
              >
                Invoice
              </Button>
            ) : null}
            {can.createActivities ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void logCollectionActivity(row, 'follow-up')}
                  disabled={createState.isLoading}
                >
                  Log follow-up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void logCollectionActivity(row, 'promise')}
                  disabled={createState.isLoading}
                >
                  Log promise
                </Button>
              </>
            ) : null}
            {canSend ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void openPreview(row)}
                disabled={previewState.isLoading}
              >
                Preview WA
              </Button>
            ) : null}
            {can.sendWhatsapp && phone ? <WhatsAppButton phone={phone} label="WhatsApp" /> : null}
          </div>
        );
      },
    },
  ];

  const activityColumns: EntityListColumn<Row>[] = [
    {
      id: 'activity',
      header: 'Follow-up',
      render: (row) => (
        <div className="el-customer">
          <div className="el-customer-meta">
            <span className="el-customer-name">{asCaption(row.activity_type)}</span>
            <span className="el-customer-sub">{asCaption(row.party_name)}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      render: (row) => asCaption(row.assigned_user_name) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      render: (row) => asCaption(row.status),
    },
    {
      id: 'when',
      header: 'Scheduled',
      render: (row) => asCaption(row.scheduled_at || row.due_at || row.promised_date),
    },
    {
      id: 'promise',
      header: 'Promised',
      render: (row) => {
        const amt = row.promised_amount;
        if (amt == null || amt === '' || Number(amt) === 0) {
          return asCaption(row.promised_date) || '—';
        }
        return (
          <span>
            {formatOutstanding(amt)}
            {row.promised_date ? ` · ${asCaption(row.promised_date)}` : ''}
          </span>
        );
      },
    },
  ];

  function renderBalanceTable(rows: Row[]) {
    if (rows.length === 0) {
      return (
        <EntityListEmpty>
          <strong>No outstanding balances</strong>
        </EntityListEmpty>
      );
    }
    return (
      <EntityListTable
        columns={balanceColumns}
        rows={rows}
        rowKey={(row) =>
          entityId(row, 'invoice_id') ||
          entityId(row, 'customer_id', 'id') ||
          String(row.customer_name)
        }
        keyboardNav
        onActivateRow={(row) => {
          const inv = invoiceHref(row);
          if (showingInvoices && inv) {
            navigate(inv);
            return;
          }
          const cid = entityId(row, 'customer_id', 'id');
          if (cid) navigate(`/parties/customers/${cid}?tab=crm`);
        }}
      />
    );
  }

  if (!collectionsEnabled) {
    return (
      <EntityListPage>
        <EntityListHero kicker="CRM" title="Collections" count="Not enabled" />
        <EntityListEmpty>
          <strong>Collections is not enabled for this CRM mode</strong>
          <p className="el-muted" style={{ margin: '8px 0 0' }}>
            Enable the collections field pack under CRM settings, or switch to a mode that includes
            it (e.g. trade).
          </p>
          <p style={{ margin: '12px 0 0' }}>
            <Link to="/settings/crm">Open CRM settings</Link>
          </p>
        </EntityListEmpty>
      </EntityListPage>
    );
  }

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Collections"
        count={
          isFetching && !isLoading
            ? 'Refreshing…'
            : showingInvoices
              ? `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'}`
              : `${balances.length} balance${balances.length === 1 ? '' : 's'}`
        }
        actions={
          <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
            Refresh
          </button>
        }
        chips={
          <FormRow label="Owner">
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </FormRow>
        }
      />

      {actionMsg ? <p style={{ marginTop: 0 }}>{actionMsg}</p> : null}
      {isLoading ? <EntityListLoading>Loading collections…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load collections.</ErrorText> : null}

      {!isLoading && !error ? (
        <div style={{ display: 'grid', gap: 28 }}>
          {hasAging ? (
            agingGroups.length === 0 ? (
              <SectionForm
                title="Outstanding"
                description="No rows matched aging buckets."
                style={{ borderBottom: 'none', paddingTop: 0 }}
              >
                {renderBalanceTable([])}
              </SectionForm>
            ) : (
              agingGroups.map((group) => (
                <SectionForm
                  key={group.label}
                  title={group.label}
                  description={
                    showingInvoices
                      ? 'Open invoices by days past due.'
                      : 'Aging bucket from due date / days past due.'
                  }
                  style={{ borderBottom: 'none', paddingTop: group === agingGroups[0] ? 0 : undefined }}
                >
                  {renderBalanceTable(group.rows)}
                </SectionForm>
              ))
            )
          ) : (
            <SectionForm
              title="Outstanding balances"
              description="Customers with open balances. Aging buckets appear when invoice due dates are available."
              style={{ borderBottom: 'none', paddingTop: 0 }}
            >
              {renderBalanceTable(balances)}
            </SectionForm>
          )}

          <SectionForm
            title="Promise register"
            description="Open payment-promise style collection activities."
            style={{ borderBottom: 'none' }}
          >
            {promises.length === 0 ? (
              <p className="el-muted" style={{ margin: 0 }}>
                No open payment promises.
              </p>
            ) : (
              <EntityListTable
                columns={activityColumns}
                rows={promises}
                rowKey={(row) => entityId(row) || String(row.activity_type)}
                keyboardNav
                onActivateRow={(row) => {
                  const aid = entityId(row);
                  if (aid) navigate(`/crm/activities/${aid}`);
                }}
                actions={(row) => {
                  const aid = entityId(row);
                  const cid = entityId(row, 'customer_id');
                  return (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {cid ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/parties/customers/${cid}?tab=crm`)}
                        >
                          Customer
                        </Button>
                      ) : null}
                      {aid ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/crm/activities/${aid}`)}
                        >
                          Open
                        </Button>
                      ) : null}
                    </div>
                  );
                }}
              />
            )}
          </SectionForm>

          <SectionForm
            title="Collection follow-ups"
            description="Scheduled payment / collection follow-ups."
            style={{ borderBottom: 'none' }}
          >
            {followUps.length === 0 ? (
              <p className="el-muted" style={{ margin: 0 }}>
                No open collection follow-ups.
              </p>
            ) : (
              <EntityListTable
                columns={activityColumns}
                rows={followUps}
                rowKey={(row) => entityId(row) || String(row.activity_type)}
                keyboardNav
                onActivateRow={(row) => {
                  const aid = entityId(row);
                  if (aid) navigate(`/crm/activities/${aid}`);
                }}
                actions={(row) => {
                  const aid = entityId(row);
                  const cid = entityId(row, 'customer_id');
                  return (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {cid ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/parties/customers/${cid}?tab=crm`)}
                        >
                          Customer
                        </Button>
                      ) : null}
                      {aid ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate(`/crm/activities/${aid}`)}
                        >
                          Open
                        </Button>
                      ) : null}
                    </div>
                  );
                }}
              />
            )}
          </SectionForm>

          <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
            Also see <Link to="/crm">CRM overview</Link> for today&apos;s queues.
          </p>
        </div>
      ) : null}

      <Drawer
        open={previewOpen}
        title="WhatsApp payment reminder"
        onClose={() => setPreviewOpen(false)}
        size="md"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            {can.sendWhatsapp && previewPhone ? (
              <WhatsAppButton phone={previewPhone} message={previewText} label="Open WhatsApp" />
            ) : null}
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {previewError ? <ErrorText>{previewError}</ErrorText> : null}
          {previewState.isLoading ? <p>Generating preview…</p> : null}
          <FormRow label="Customer">
            <input
              readOnly
              value={
                selectedCustomer
                  ? entityCaption(selectedCustomer, 'customer_name', 'party_name', 'name')
                  : ''
              }
            />
          </FormRow>
          <FormRow label="Phone">
            <input
              value={previewPhone}
              onChange={(e) => setPreviewPhone(e.target.value)}
            />
          </FormRow>
          <FormRow label="Message preview">
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={6}
              style={{ width: '100%' }}
            />
          </FormRow>
        </div>
      </Drawer>
    </EntityListPage>
  );
}

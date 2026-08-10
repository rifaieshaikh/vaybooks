import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useGetCrmCollectionsQuery,
  usePreviewCrmWhatsappPaymentReminderMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityListEmpty,
  EntityListHero,
  EntityListLoading,
  EntityListPage,
  EntityListTable,
  ErrorText,
  FormRow,
  Modal,
  type EntityListColumn,
} from '@vaybooks/ui-kit';
import { SectionForm, WhatsAppButton } from '../components';
import { useCrmCan } from '../hooks';
import { asEntityList, entityCaption, entityId, formatOutstanding } from '../overviewHelpers';
import { asCaption, extractError } from '../utils';

type Row = Record<string, unknown>;

export function CrmCollectionsPage() {
  const navigate = useNavigate();
  const can = useCrmCan();
  const { data, isLoading, error, refetch, isFetching } = useGetCrmCollectionsQuery();
  const [previewReminder, previewState] = usePreviewCrmWhatsappPaymentReminderMutation();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Row | null>(null);

  const snap = (data || {}) as Record<string, unknown>;
  const balances = useMemo(() => asEntityList(snap.balances), [snap.balances]);
  const followUps = useMemo(() => asEntityList(snap.follow_ups), [snap.follow_ups]);
  const promises = useMemo(() => asEntityList(snap.payment_promises), [snap.payment_promises]);
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
        outstanding_amount: Number(row.outstanding_amount ?? row.balance ?? row.amount ?? 0) || undefined,
      }).unwrap();
      setPreviewText(
        String(result.message || result.preview || result.body || result.text || JSON.stringify(result)),
      );
      if (result.phone) setPreviewPhone(String(result.phone));
    } catch (e) {
      setPreviewError(extractError(e));
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
    {
      id: 'outstanding',
      header: 'Outstanding',
      className: 'el-num',
      headerClassName: 'el-col-num',
      render: (row) =>
        formatOutstanding(row.outstanding_amount ?? row.balance ?? row.amount) || '—',
    },
    {
      id: 'actions',
      header: 'Reminder',
      render: (row) => {
        const phone = String(row.phone || row.mobile || '');
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            {phone ? <WhatsAppButton phone={phone} label="WhatsApp" /> : null}
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
      id: 'status',
      header: 'Status',
      render: (row) => asCaption(row.status),
    },
    {
      id: 'when',
      header: 'Scheduled',
      render: (row) => asCaption(row.scheduled_at || row.due_at),
    },
  ];

  return (
    <EntityListPage>
      <EntityListHero
        kicker="CRM"
        title="Collections"
        count={
          isFetching && !isLoading
            ? 'Refreshing…'
            : `${balances.length} balance${balances.length === 1 ? '' : 's'}`
        }
        actions={
          <button type="button" className="el-btn-ghost" onClick={() => void refetch()}>
            Refresh
          </button>
        }
      />

      {isLoading ? <EntityListLoading>Loading collections…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load collections.</ErrorText> : null}

      {!isLoading && !error ? (
        <div style={{ display: 'grid', gap: 28 }}>
          <SectionForm
            title="Outstanding balances"
            description="Customers with open balances."
            style={{ borderBottom: 'none', paddingTop: 0 }}
          >
            {balances.length === 0 ? (
              <EntityListEmpty>
                <strong>No outstanding balances</strong>
              </EntityListEmpty>
            ) : (
              <EntityListTable
                columns={balanceColumns}
                rows={balances}
                rowKey={(row) => entityId(row, 'customer_id', 'id') || String(row.customer_name)}
                onActivateRow={(row) => {
                  const cid = entityId(row, 'customer_id', 'id');
                  if (cid) navigate(`/parties/customers/${cid}`);
                }}
              />
            )}
          </SectionForm>

          <SectionForm
            title="Payment promises"
            description="Open promise-related collection activities."
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
                actions={(row) => {
                  const aid = entityId(row);
                  return aid ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate(`/crm/activities/${aid}`)}
                    >
                      Open
                    </Button>
                  ) : null;
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
                actions={(row) => {
                  const aid = entityId(row);
                  return aid ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate(`/crm/activities/${aid}`)}
                    >
                      Open
                    </Button>
                  ) : null;
                }}
              />
            )}
          </SectionForm>

          <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
            Also see <Link to="/crm">CRM overview</Link> for today&apos;s queues.
          </p>
        </div>
      ) : null}

      <Modal
        open={previewOpen}
        title="WhatsApp payment reminder"
        onClose={() => setPreviewOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            {previewPhone ? (
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
      </Modal>
    </EntityListPage>
  );
}

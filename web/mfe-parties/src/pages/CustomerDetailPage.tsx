import {
  Button,
  EntityDetailBack,
  EntityDetailBanner,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityDetailTabs,
  EntityListLoading,
  ErrorText,
  FormRow,
  StatusPill,
  TextInput,
} from '@vaybooks/ui-kit';
import {
  useBlacklistCustomerMutation,
  useCan,
  useGetBoutiqueCustomerRelatedSummaryQuery,
  useGetCrmCustomerRelatedQuery,
  useGetCustomerQuery,
  useGetCustomerSummaryQuery,
  useGetFinanceAccountQuery,
  useGetProjectsCustomerRelatedSummaryQuery,
  useGetSalesCustomerProductHistoryQuery,
  useGetSalesCustomerRelatedSummaryQuery,
  useListCustomerPriceHistoryQuery,
  useListCustomerPricesQuery,
  useListFinanceAccountsQuery,
  useListPartySegmentsQuery,
  useRefundCustomerMutation,
  useSettleCustomerMutation,
  useUpdateCustomerMutation,
} from '@vaybooks/store';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CustomerFormFields,
  customerBody,
  customerLocationIds,
  customerToForm,
  emptyCustomerForm,
  validateCustomerForm,
} from '../components/CustomerFormFields';
import { CustomerPricingPanel, customerDiscountSettingsHref } from '../components/CustomerPricingPanel';
import { Modal } from '../components/Modal';
import { type PartyFormValues } from '../components/PartyFields';
import { usePartyLocationIds } from '../components/PartyLocationFields';
import './CustomerDetail.css';

type TabId =
  | 'overview'
  | 'activity'
  | 'finance'
  | 'products'
  | 'prices'
  | 'pricing'
  | 'crm'
  | 'price-history';

const TAB_IDS: TabId[] = [
  'overview',
  'activity',
  'finance',
  'products',
  'prices',
  'pricing',
  'crm',
  'price-history',
];

function parseTab(raw: string | null): TabId | null {
  if (!raw) return null;
  return TAB_IDS.includes(raw as TabId) ? (raw as TabId) : null;
}

function money(v: unknown) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function mph(v: unknown) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${money(n)}/h`;
}

function count(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isNaN(n) ? '0' : String(n);
}

function refLabel(r: Record<string, unknown>) {
  return String(r.number || r.order_number || r.name || r.id || '—');
}

function dateLabel(r: Record<string, unknown>) {
  const raw = String(
    r.sale_date ||
      r.order_date ||
      r.scheduled_at ||
      r.follow_up_date ||
      r.created_at ||
      r.start_date ||
      r.date ||
      '—',
  );
  return raw.length > 16 ? raw.slice(0, 10) : raw;
}

function ActivityBlock({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <section className="cd-activity-block">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="cd-empty">No recent records.</div>
      ) : (
        rows.slice(0, 5).map((r, i) => (
          <div className="cd-activity-row" key={String(r.id || i)}>
            <span>{refLabel(r)}</span>
            <span>{dateLabel(r)}</span>
            <span>{String(r.status || r.state || '—')}</span>
          </div>
        ))
      )}
    </section>
  );
}

function CrmRelatedBlock({
  title,
  rows,
  hrefOf,
  labelOf,
  limit,
}: {
  title: string;
  rows: Record<string, unknown>[];
  hrefOf: (r: Record<string, unknown>) => string | null;
  labelOf: (r: Record<string, unknown>) => string;
  limit?: number;
}) {
  const shown = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return (
    <section className="cd-activity-block">
      <h4>{title}</h4>
      {shown.length === 0 ? (
        <div className="cd-empty">No linked records.</div>
      ) : (
        shown.map((r, i) => {
          const href = hrefOf(r);
          const label = labelOf(r);
          return (
            <div className="cd-activity-row" key={String(r.id || i)}>
              <span>
                {href ? (
                  <Link className="cd-text-link" to={href}>
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </span>
              <span>{dateLabel(r)}</span>
              <span>{String(r.status || r.state || '—')}</span>
            </div>
          );
        })
      )}
    </section>
  );
}

function formatWhen(v: unknown) {
  if (v == null || v === '') return '—';
  const raw = String(v);
  return raw.length > 16 ? raw.slice(0, 16).replace('T', ' ') : raw;
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCan();
  const canEdit = can('parties.customers.edit');
  const canBlacklist = can('parties.customers.blacklist');
  const canFinance = can('parties.customers.finance.view');
  const canSettle = can('parties.customers.finance.settle');
  const canInsights = can('parties.customers.insights.view');
  const canAccounts = can('finance.accounts.view');
  const canProducts = can('sales.invoices.view');
  const canPrices = can('inventory.customer_prices.view');
  const canCrm = can('crm.leads.view');
  const canPricing = can('settings.discounts.view');
  const canBoutiqueView = can('boutique.orders.view');
  const canBoutiqueCreate = can('boutique.orders.create');
  const canProjectCreate = can('projects.projects.create');
  const canProjectView = can('projects.projects.view');
  const canEnquiryCreate = can('projects.enquiries.create');
  const canSoView = can('sales.orders.view');
  const canSoCreate = can('sales.orders.create');
  const canInvView = can('sales.invoices.view');
  const canInvCreate = can('sales.invoices.create');
  const canReceiptCreate = can('finance.receipts.create');
  const canRefundCreate = can('finance.payments.create');

  const { data, isLoading, error, refetch } = useGetCustomerQuery(id, { skip: !id });
  const summary = useGetCustomerSummaryQuery(id, { skip: !id });
  const salesRel = useGetSalesCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
  const boutiqueRel = useGetBoutiqueCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
  const projectsRel = useGetProjectsCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
  const crmRel = useGetCrmCustomerRelatedQuery(id, { skip: !id || !canCrm });
  const { data: segments = [] } = useListPartySegmentsQuery({ applies_to: 'customer', active_only: false });

  const accountId = String(summary.data?.account_id || '');
  const financeAcct = useGetFinanceAccountQuery(accountId, {
    skip: !accountId || !canFinance,
  });
  const productHistory = useGetSalesCustomerProductHistoryQuery(id, {
    skip: !id || !canProducts,
  });
  const priceRows = useListCustomerPricesQuery(
    { customer_id: id },
    { skip: !id || !canPrices },
  );
  const [historyProductId, setHistoryProductId] = useState('');
  const priceHistory = useListCustomerPriceHistoryQuery(
    { customer_id: id, product_id: historyProductId },
    { skip: !id || !canPrices || !historyProductId },
  );

  useEffect(() => {
    const rows = priceRows.data || [];
    if (!rows.length) {
      setHistoryProductId('');
      return;
    }
    setHistoryProductId((prev) => {
      if (prev && rows.some((r) => String(r.product_id) === prev)) return prev;
      return String(rows[0].product_id || '');
    });
  }, [priceRows.data]);

  const [updateCustomer] = useUpdateCustomerMutation();
  const [blacklist] = useBlacklistCustomerMutation();
  const [settle] = useSettleCustomerMutation();
  const [refundCustomer] = useRefundCustomerMutation();
  const storeAccounts = useListFinanceAccountsQuery(
    { store_only: true, active_only: true },
    { skip: !canRefundCreate },
  );

  const tabFromUrl = parseTab(searchParams.get('tab'));
  const [tab, setTab] = useState<TabId>(tabFromUrl || 'overview');
  useEffect(() => {
    if (tabFromUrl) setTab(tabFromUrl);
  }, [tabFromUrl]);
  const [editOpen, setEditOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [settleAmt, setSettleAmt] = useState('0');
  const [settleReason, setSettleReason] = useState('Uncollectible balance');
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refundAmt, setRefundAmt] = useState('0');
  const [refundDesc, setRefundDesc] = useState('Customer refund');
  const [refundDate, setRefundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refundStoreId, setRefundStoreId] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [values, setValues] = useState<PartyFormValues>(emptyCustomerForm());
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const existingLocationIds = useMemo(
    () => (data ? customerLocationIds(data as Record<string, unknown>) : []),
    [data],
  );
  const locationState = usePartyLocationIds({
    mode: 'edit',
    existingIds: existingLocationIds,
    resetKey: editOpen ? id : '',
  });

  const segmentOptions = useMemo(
    () => segments.map((s) => ({ id: String(s.id), name: String(s.name || s.id) })),
    [segments],
  );

  const ledgerRows = useMemo(() => {
    const rows = financeAcct.data?.ledger;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }, [financeAcct.data]);

  if (isLoading) {
    return (
      <EntityDetailPage className="cd-page">
        <EntityListLoading>Loading customer…</EntityListLoading>
      </EntityDetailPage>
    );
  }
  if (error || !data) {
    return (
      <EntityDetailPage className="cd-page">
        <EntityDetailBack to="/parties/customers" label="Customers" />
        <ErrorText>Customer not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const customer = data;
  const segmentIds = Array.isArray(customer.segment_ids)
    ? (customer.segment_ids as string[]).map(String)
    : [];
  const segmentLabels = segmentIds
    .map((sid) => segmentOptions.find((s) => s.id === sid)?.name || sid)
    .filter(Boolean);
  const s = summary.data || {};
  const blacklisted = Boolean(customer.is_blacklisted);

  const salesCounts = (salesRel.data?.counts || {}) as Record<string, number>;
  const boutiqueSummary = (boutiqueRel.data?.summary || {}) as Record<string, unknown>;
  const projectsSummary = (projectsRel.data?.summary || {}) as Record<string, unknown>;

  const salesN = Number(salesCounts.sales_orders || 0) + Number(salesCounts.sales_invoices || 0);
  const boutiqueN = Number(boutiqueSummary.order_count || 0);
  const projectsN = Number(projectsSummary.project_count || 0);
  const mixTotal = Math.max(salesN + boutiqueN + projectsN, 1);

  let buyingStyle = 'Limited history';
  let buyingCopy = 'Not enough commercial activity yet to classify purchasing style.';
  if (projectsN > 0 && projectsN >= boutiqueN && projectsN >= salesN) {
    buyingStyle = 'Project / contract';
    buyingCopy = 'Engagement is weighted toward projects and contract value.';
  } else if (boutiqueN > 0 && boutiqueN >= salesN) {
    buyingStyle = 'Boutique / customization';
    buyingCopy = 'Repeat customization and made-to-order work dominate this relationship.';
  } else if (salesN > 0) {
    buyingStyle = 'Trading / retail sales';
    buyingCopy = 'Activity is mainly trading documents — orders and invoices.';
  }

  const outstanding = Number(s.open_invoice_outstanding ?? s.receivable_balance ?? 0);
  const outstandingDue = outstanding > 0.009;

  const customerName = String(customer.customer_name || '');
  const customerNameQ = encodeURIComponent(customerName);
  const customerIdQ = encodeURIComponent(id);

  const viewItems = [
    canBoutiqueView
      ? {
          label: 'Customization orders',
          to: `/boutique/orders?customer_id=${customerIdQ}&customer_name=${customerNameQ}`,
          kb: 'customers.view_orders' as const,
        }
      : null,
    canSoView
      ? {
          label: 'Sales orders',
          to: `/sales/orders?customer_id=${customerIdQ}&customer_name=${customerNameQ}`,
        }
      : null,
    canInvView
      ? {
          label: 'Sales invoices',
          to: `/sales/invoices?customer_id=${customerIdQ}&customer_name=${customerNameQ}`,
        }
      : null,
    canProjectView
      ? { label: 'Projects', to: `/projects/list?customer_id=${customerIdQ}` }
      : null,
  ].filter(Boolean) as { label: string; to: string; kb?: string }[];

  const newItems = !blacklisted
    ? ([
        canBoutiqueCreate
          ? {
              label: 'Customization order',
              to: `/boutique/orders/workspace?customer_id=${customerIdQ}`,
            }
          : null,
        canEnquiryCreate
          ? {
              label: 'Project enquiry',
              to: `/projects/enquiries?customer_id=${customerIdQ}&new=1`,
            }
          : null,
        canProjectCreate
          ? { label: 'Project', to: `/projects/list?customer_id=${customerIdQ}&new=1` }
          : null,
        canSoCreate
          ? { label: 'Sales order', to: `/sales/orders?customer_id=${customerIdQ}&new=1` }
          : null,
        canInvCreate
          ? { label: 'Sales invoice', to: `/sales/invoices?customer_id=${customerIdQ}&new=1` }
          : null,
      ].filter(Boolean) as { label: string; to: string }[])
    : [];

  function openSettle() {
    setSettleAmt(String(s.receivable_balance ?? s.open_invoice_outstanding ?? 0));
    setSettleOpen(true);
  }

  function openRefund() {
    const credit = Number(s.credit_balance ?? 0);
    setRefundAmt(String(credit > 0 ? credit : 0));
    setRefundDesc('Customer refund');
    setRefundDate(new Date().toISOString().slice(0, 10));
    const stores = storeAccounts.data || [];
    setRefundStoreId(stores[0] ? String(stores[0].id) : '');
    setRefundOpen(true);
  }

  type ActionLink = { kind: 'link'; label: string; to: string; kb?: string };
  type ActionButton = { kind: 'button'; label: string; onClick: () => void };
  type ActionItem = ActionLink | ActionButton;

  const financeItems: ActionItem[] = [
    !blacklisted && canReceiptCreate && accountId
      ? {
          kind: 'link' as const,
          label: 'Receipt',
          to: `/finance/receipts?customer_account_id=${encodeURIComponent(accountId)}&new=1`,
        }
      : null,
    canRefundCreate && accountId
      ? { kind: 'button' as const, label: 'Refund', onClick: () => openRefund() }
      : null,
    canSettle ? { kind: 'button' as const, label: 'Settle', onClick: () => openSettle() } : null,
  ].filter(Boolean) as ActionItem[];

  const showQa = viewItems.length > 0 || newItems.length > 0 || financeItems.length > 0;

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'activity', label: 'Activity', show: canInsights },
    { id: 'crm', label: 'CRM', show: canCrm },
    { id: 'finance', label: 'Finance', show: canFinance },
    { id: 'products', label: 'Products bought', show: canProducts },
    { id: 'prices', label: 'Current rates', show: canPrices },
    { id: 'pricing', label: 'Discounts', show: canPricing },
    { id: 'price-history', label: 'Rate history', show: canPrices },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'overview';

  function selectTab(next: TabId) {
    setTab(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'overview') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  }

  const snapshotItems = [
    ...(customer.email
      ? [{ label: 'Email', value: String(customer.email) }]
      : []),
    ...(canFinance
      ? [
          {
            label: 'Outstanding',
            value: (
              <span style={{ color: outstandingDue ? 'var(--cd-danger, #a12828)' : 'var(--cd-ok, #0f6b4c)' }}>
                {money(s.open_invoice_outstanding ?? s.receivable_balance)}
              </span>
            ),
          },
          { label: 'Balance', value: money(s.balance) },
          { label: 'Credit', value: money(s.credit_balance) },
          { label: 'Advance', value: money(s.advance) },
          { label: 'Parked', value: money(s.parked_settlement) },
        ]
      : []),
  ];

  function openEdit() {
    setValues(customerToForm(customer as Record<string, unknown>));
    setFormError('');
    setEditOpen(true);
  }

  return (
    <EntityDetailPage className="cd-page">
      <EntityDetailBack to="/parties/customers" label="Customers" />

      <EntityDetailHero
        kicker="Parties · Customer"
        title={String(customer.customer_name)}
        lead={
          <>
            <StatusPill
              status={blacklisted ? 'Blacklisted' : 'Active'}
              tone={blacklisted ? 'danger' : 'success'}
            />
            <span className="ed-lead-sep">
              {' '}
              · {String(customer.phone_number || 'No phone on file')}
            </span>
            {customer.email ? <span className="ed-lead-sep"> · {String(customer.email)}</span> : null}
            {customer.gstin ? (
              <span className="ed-lead-sep"> · GSTIN {String(customer.gstin)}</span>
            ) : null}
            {segmentLabels.length > 0 ? (
              <span className="cd-hero-segments" aria-label="Segments">
                {segmentLabels.map((label) => (
                  <span className="cd-chip" key={label}>
                    {label}
                  </span>
                ))}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {canEdit ? <Button onClick={openEdit}>Edit</Button> : null}
            {canBlacklist ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setBlacklistReason('');
                  setBlacklistOpen(true);
                }}
              >
                {blacklisted ? 'Remove blacklist' : 'Blacklist'}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                refetch();
                summary.refetch();
              }}
            >
              Refresh
            </Button>
          </>
        }
      />

      <EntityDetailSnapshot ariaLabel="Customer facts" items={snapshotItems} />

      {blacklisted ? (
        <EntityDetailBanner>
          This customer is blacklisted. Creates are blocked — Settle remains available when permitted.
        </EntityDetailBanner>
      ) : null}

      {showQa ? (
        <section className="cd-qa" aria-label="Actions">
          <div className="cd-qa-head">
            <h3>Actions</h3>
            {blacklisted ? (
              <p className="cd-qa-caption">
                New actions are blocked while blacklisted — View and Finance remain available.
              </p>
            ) : null}
          </div>
          {viewItems.length > 0 ? (
            <div className="cd-qa-group">
              <h4 className="cd-qa-group-title">View</h4>
              <div className="cd-qa-row">
                {viewItems.map((a) => (
                  <Link
                    key={a.to}
                    className="cd-qa-btn"
                    to={a.to}
                    {...(a.kb ? { 'data-kb-action': a.kb } : {})}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {newItems.length > 0 ? (
            <div className="cd-qa-group">
              <h4 className="cd-qa-group-title">New</h4>
              <div className="cd-qa-row">
                {newItems.map((a) => (
                  <Link key={a.to} className="cd-qa-btn" to={a.to}>
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {financeItems.length > 0 ? (
            <div className="cd-qa-group">
              <h4 className="cd-qa-group-title">Finance</h4>
              <div className="cd-qa-row">
                {financeItems.map((a) =>
                  a.kind === 'link' ? (
                    <Link key={a.to} className="cd-qa-btn" to={a.to}>
                      {a.label}
                    </Link>
                  ) : (
                    <button key={a.label} type="button" className="cd-qa-btn" onClick={a.onClick}>
                      {a.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {actionError ? <ErrorText>{actionError}</ErrorText> : null}

      {visibleTabs.length > 1 ? (
        <EntityDetailTabs
          value={activeTab}
          ariaLabel="Customer sections"
          onChange={(next) => selectTab(next as TabId)}
          options={visibleTabs.map((t) => ({ id: t.id, label: t.label }))}
        />
      ) : null}

      {activeTab === 'overview' ? (
        <EntityDetailPanel key="overview" title="Overview">
          {canInsights ? (
            <section className="cd-insight">
              <h3>{buyingStyle}</h3>
              <p>{buyingCopy}</p>
              <div className="cd-mix">
                {[
                  { label: 'Sales', value: salesN },
                  { label: 'Boutique', value: boutiqueN },
                  { label: 'Projects', value: projectsN },
                ].map((row) => (
                  <div className="cd-mix-row" key={row.label}>
                    <span>{row.label}</span>
                    <div className="cd-mix-track">
                      <div
                        className="cd-mix-fill"
                        style={{ width: `${Math.round((row.value / mixTotal) * 100)}%` }}
                      />
                    </div>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {canInsights ? (
            <div className="cd-modules">
              <article className="cd-module">
                <h4>Sales</h4>
                <div className="cd-module-kpis">
                  <div className="cd-kpi">
                    <span>Estimates</span>
                    <strong>{count(salesCounts.estimates)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Quotations</span>
                    <strong>{count(salesCounts.quotations)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Orders</span>
                    <strong>{count(salesCounts.sales_orders)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Delivery notes</span>
                    <strong>{count(salesCounts.delivery_notes)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Invoices</span>
                    <strong>{count(salesCounts.sales_invoices)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Returns</span>
                    <strong>{count(salesCounts.sales_returns)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Receipts</span>
                    <strong>{count(salesCounts.receipts)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Outstanding</span>
                    <strong>
                      {salesRel.data?.available ? money(salesRel.data.outstanding) : '—'}
                    </strong>
                  </div>
                </div>
              </article>
              <article className="cd-module">
                <h4>Boutique</h4>
                <div className="cd-module-kpis">
                  <div className="cd-kpi">
                    <span>Orders</span>
                    <strong>{count(boutiqueSummary.order_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Active</span>
                    <strong>{count(boutiqueSummary.active_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Delivered</span>
                    <strong>{count(boutiqueSummary.delivered_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Completed</span>
                    <strong>{count(boutiqueSummary.completed_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Invoiced</span>
                    <strong>{money(boutiqueSummary.total_invoiced)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Margin</span>
                    <strong>{money(boutiqueSummary.total_margin)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>In-house hours</span>
                    <strong>
                      {boutiqueSummary.total_hours == null
                        ? '—'
                        : Number(boutiqueSummary.total_hours).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                    </strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Avg MPH</span>
                    <strong>{mph(boutiqueSummary.avg_mph)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Outstanding</span>
                    <strong>
                      {money(boutiqueSummary.outstanding ?? boutiqueRel.data?.outstanding)}
                    </strong>
                  </div>
                </div>
              </article>
              <article className="cd-module">
                <h4>Projects</h4>
                <div className="cd-module-kpis">
                  <div className="cd-kpi">
                    <span>Projects</span>
                    <strong>{count(projectsSummary.project_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Active</span>
                    <strong>{count(projectsSummary.active_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Completed</span>
                    <strong>{count(projectsSummary.completed_count)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Contract</span>
                    <strong>{money(projectsSummary.contract_value)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Billed</span>
                    <strong>{money(projectsSummary.total_billed_revenue)}</strong>
                  </div>
                  <div className="cd-kpi">
                    <span>Avg margin</span>
                    <strong>{money(projectsSummary.avg_margin)}</strong>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <p className="cd-empty">Overview shows identity and finance. Insights require additional permission.</p>
          )}
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'activity' && canInsights ? (
        <EntityDetailPanel key="activity" title="Activity" className="cd-activity">
          <ActivityBlock title="Recent sales" rows={(salesRel.data?.recent as Record<string, unknown>[]) || []} />
          <ActivityBlock
            title="Recent boutique orders"
            rows={(boutiqueRel.data?.recent as Record<string, unknown>[]) || []}
          />
          <ActivityBlock
            title="Recent projects"
            rows={(projectsRel.data?.recent as Record<string, unknown>[]) || []}
          />
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'crm' && canCrm ? (
        <EntityDetailPanel
          key="crm"
          title="CRM"
          className="cd-activity"
          headerEnd={
            <div className="cd-crm-actions">
              <Link
                className="cd-text-link"
                to={`/crm/activities?new=1&customer_id=${encodeURIComponent(id)}`}
              >
                New activity
              </Link>
              <Link
                className="cd-text-link"
                to={`/crm/activities?new=1&customer_id=${encodeURIComponent(id)}&activity_type=${encodeURIComponent('Payment Reminder')}`}
              >
                Log collection follow-up
              </Link>
            </div>
          }
        >
          {crmRel.isLoading ? (
            <p className="cd-empty">Loading CRM records…</p>
          ) : crmRel.error ? (
            <p className="cd-empty" style={{ color: '#a12828' }}>
              Failed to load CRM records.
            </p>
          ) : (
            <>
              {(() => {
                const leadRows = (crmRel.data?.leads as Record<string, unknown>[]) || [];
                const enquiryRows =
                  (crmRel.data?.enquiries as Record<string, unknown>[]) || [];
                const activityRows =
                  (crmRel.data?.activities as Record<string, unknown>[]) || [];
                const timelineRows =
                  (crmRel.data?.recent_activities as Record<string, unknown>[]) ||
                  (crmRel.data?.timeline as Record<string, unknown>[]) ||
                  activityRows;
                const crmOutstanding =
                  crmRel.data?.open_invoice_outstanding ??
                  crmRel.data?.outstanding_balance ??
                  s.open_invoice_outstanding ??
                  s.receivable_balance;
                const primaryLead = leadRows[0];
                const primaryEnquiry = enquiryRows[0];
                return (
                  <>
                    <div className="cd-crm-strip">
                      <div className="cd-kpi">
                        <span>Outstanding</span>
                        <strong>{money(crmOutstanding)}</strong>
                      </div>
                      <div className="cd-kpi">
                        <span>Last contact</span>
                        <strong>{formatWhen(crmRel.data?.last_contact_at)}</strong>
                      </div>
                      <div className="cd-kpi">
                        <span>Next follow-up</span>
                        <strong>{formatWhen(crmRel.data?.next_follow_up_at)}</strong>
                      </div>
                    </div>
                    <div className="cd-crm-actions" style={{ marginBottom: '0.85rem' }}>
                      {primaryLead?.id ? (
                        <Link className="cd-text-link" to={`/crm/leads/${String(primaryLead.id)}`}>
                          Open lead
                        </Link>
                      ) : (
                        <Link
                          className="cd-text-link"
                          to={`/crm/leads?new=1&customer_id=${encodeURIComponent(id)}`}
                        >
                          New lead
                        </Link>
                      )}
                      {primaryEnquiry?.id ? (
                        <Link
                          className="cd-text-link"
                          to={`/crm/enquiries/${String(primaryEnquiry.id)}`}
                        >
                          Open enquiry
                        </Link>
                      ) : (
                        <Link
                          className="cd-text-link"
                          to={`/crm/enquiries?new=1&customer_id=${encodeURIComponent(id)}`}
                        >
                          New enquiry
                        </Link>
                      )}
                      <Link className="cd-text-link" to="/crm/collections">
                        Collections
                      </Link>
                    </div>
                    <p className="cd-empty" style={{ margin: '0 0 0.75rem', padding: 0 }}>
                      {leadRows.length} lead{leadRows.length === 1 ? '' : 's'} ·{' '}
                      {enquiryRows.length} enquir
                      {enquiryRows.length === 1 ? 'y' : 'ies'} ·{' '}
                      {activityRows.length} activit
                      {activityRows.length === 1 ? 'y' : 'ies'}
                    </p>
                    <CrmRelatedBlock
                      title="Timeline"
                      rows={timelineRows}
                      limit={8}
                      hrefOf={(r) => (r.id ? `/crm/activities/${String(r.id)}` : null)}
                      labelOf={(r) =>
                        String(r.activity_type || r.title || r.outcome || r.id || 'Activity')
                      }
                    />
                    <CrmRelatedBlock
                      title="Leads"
                      rows={leadRows}
                      hrefOf={(r) => (r.id ? `/crm/leads/${String(r.id)}` : null)}
                      labelOf={(r) =>
                        String(r.name || r.lead_number || r.id || 'Lead')
                      }
                    />
                    <CrmRelatedBlock
                      title="Enquiries"
                      rows={enquiryRows}
                      hrefOf={(r) => (r.id ? `/crm/enquiries/${String(r.id)}` : null)}
                      labelOf={(r) =>
                        String(r.enquiry_number || r.party_name || r.id || 'Enquiry')
                      }
                    />
                    <CrmRelatedBlock
                      title="Activities"
                      rows={activityRows}
                      hrefOf={(r) => (r.id ? `/crm/activities/${String(r.id)}` : null)}
                      labelOf={(r) =>
                        String(r.activity_type || r.title || r.id || 'Activity')
                      }
                    />
                  </>
                );
              })()}
            </>
          )}
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'finance' && canFinance ? (
        <EntityDetailPanel
          key="finance"
          title="Ledger"
          headerEnd={
            accountId && canAccounts ? (
              <Link className="cd-text-link" to={`/finance/accounts/${accountId}`}>
                Open full account
              </Link>
            ) : null
          }
        >
          {!accountId ? (
            <p className="cd-empty">No ledger account linked.</p>
          ) : financeAcct.isLoading ? (
            <p className="cd-empty">Loading ledger…</p>
          ) : ledgerRows.length === 0 ? (
            <p className="cd-empty">No ledger lines yet.</p>
          ) : (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((line, i) => (
                    <tr key={i}>
                      <td>{String(line.voucher_date || '').slice(0, 10)}</td>
                      <td>{String(line.voucher_number || '')}</td>
                      <td>{String(line.description || '—')}</td>
                      <td>{money(line.debit)}</td>
                      <td>{money(line.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'products' && canProducts ? (
        <EntityDetailPanel key="products" title="Products">
          {productHistory.isLoading ? (
            <p className="cd-empty">Loading product history…</p>
          ) : (productHistory.data || []).length === 0 ? (
            <p className="cd-empty">No sales invoice product lines for this customer.</p>
          ) : (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(productHistory.data || []).map((row, i) => (
                    <tr key={`${String(row.doc_number)}-${String(row.product_id)}-${i}`}>
                      <td>{String(row.date || '').slice(0, 10)}</td>
                      <td>{String(row.doc_number || '')}</td>
                      <td>
                        {String(row.product_name || row.sku || row.product_id || '—')}
                        {row.sku ? ` · ${String(row.sku)}` : ''}
                      </td>
                      <td>{count(row.qty)}</td>
                      <td>{money(row.rate)}</td>
                      <td>{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'prices' && canPrices ? (
        <EntityDetailPanel key="prices" title="Current rates">
          {priceRows.isLoading ? (
            <p className="cd-empty">Loading prices…</p>
          ) : (priceRows.data || []).length === 0 ? (
            <p className="cd-empty">No customer prices recorded.</p>
          ) : (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Rate</th>
                    <th>Effective</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(priceRows.data || []).map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.product_name || r.sku || r.product_id || '—')}</td>
                      <td>{money(r.customer_rate ?? r.rate)}</td>
                      <td>{String(r.effective_date || r.created_at || '—').slice(0, 10)}</td>
                      <td>{String(r.notes || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canPrices ? (
            <p className="cd-ledger-foot">
              <button type="button" className="cd-text-link" onClick={() => selectTab('price-history')}>
                View rate history
              </button>
            </p>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'pricing' && canPricing ? (
        <EntityDetailPanel
          key="pricing"
          title="Discounts"
          headerEnd={
            <Link
              className="cd-text-link"
              to={customerDiscountSettingsHref(id, can('settings.discounts.edit'))}
            >
              {can('settings.discounts.edit') ? 'Manage in settings' : 'Open settings'}
            </Link>
          }
        >
          <CustomerPricingPanel customerId={id} segmentIds={segmentIds} />
        </EntityDetailPanel>
      ) : null}

      {activeTab === 'price-history' && canPrices ? (
        <EntityDetailPanel key="price-history" title="Rate history">
          {(priceRows.data || []).length === 0 ? (
            <p className="cd-empty">No current customer rates — add a rate before viewing history.</p>
          ) : (
            <>
              <div className="cd-history-toolbar">
                <FormRow label="Product">
                  <select
                    className="cd-select"
                    value={historyProductId}
                    onChange={(e) => setHistoryProductId(e.target.value)}
                  >
                    {(priceRows.data || []).map((r) => (
                      <option key={String(r.id)} value={String(r.product_id)}>
                        {String(r.product_name || r.sku || r.product_id || '—')}
                      </option>
                    ))}
                  </select>
                </FormRow>
              </div>
              {priceHistory.isLoading ? (
                <p className="cd-empty">Loading rate history…</p>
              ) : priceHistory.error ? (
                <p className="cd-empty" style={{ color: '#a12828' }}>
                  Failed to load rate history.
                </p>
              ) : (priceHistory.data || []).length === 0 ? (
                <p className="cd-empty">No price history for this product.</p>
              ) : (
                <div className="cd-table-wrap">
                  <table className="cd-table">
                    <thead>
                      <tr>
                        <th>Customer rate</th>
                        <th>List rate</th>
                        <th>Difference</th>
                        <th>Effective</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(priceHistory.data || []).map((row, i) => (
                        <tr key={String(row.id || i)}>
                          <td>{money(row.customer_rate ?? row.rate)}</td>
                          <td>{money(row.selling_rate)}</td>
                          <td>{money(row.difference)}</td>
                          <td>{String(row.effective_date || row.created_at || '—').slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </EntityDetailPanel>
      ) : null}

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/parties/customers')}>
            Back to list
          </Button>
        }
        end={
          <>
            {canSettle ? (
              <Button type="button" variant="ghost" onClick={openSettle}>
                Settle
              </Button>
            ) : null}
            {canEdit ? <Button type="button" onClick={openEdit}>Edit</Button> : null}
          </>
        }
      />

      <Modal
        title="Edit Customer"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <Button
              type="button"
              data-kb-action="customers.save"
              onClick={async () => {
                const validation = validateCustomerForm(values);
                if (validation) {
                  setFormError(validation);
                  return;
                }
                const loc = locationState.resolveForSave();
                if (loc.error) {
                  setFormError(loc.error);
                  return;
                }
                setFormError('');
                try {
                  await updateCustomer({ id, body: customerBody(values, loc.locationIds) }).unwrap();
                  setEditOpen(false);
                  refetch();
                } catch (e: unknown) {
                  const msg =
                    e && typeof e === 'object' && 'data' in e
                      ? String((e as { data?: { detail?: string } }).data?.detail || 'Save failed')
                      : 'Save failed';
                  setFormError(msg);
                }
              }}
            >
              Save Changes
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {formError ? <ErrorText>{formError}</ErrorText> : null}
        <CustomerFormFields
          values={values}
          onChange={(n, v) => {
            setValues((p) => ({ ...p, [n]: v }));
            if (formError) setFormError('');
          }}
          segmentOptions={segmentOptions}
          locationPicker={{
            showPicker: locationState.showPicker,
            locationIds: locationState.locationIds,
            setLocationIds: locationState.setLocationIds,
            accessible: locationState.accessible,
          }}
        />
      </Modal>

      <Modal
        title="Park settlement"
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                setActionError('');
                try {
                  await settle({
                    id,
                    amount: Number(settleAmt) || 0,
                    mode: 'park',
                    reason: settleReason,
                    voucher_date: settleDate,
                  }).unwrap();
                  setSettleOpen(false);
                  summary.refetch();
                  if (accountId) financeAcct.refetch();
                } catch (e: unknown) {
                  setActionError(
                    e && typeof e === 'object' && 'data' in e
                      ? String((e as { data?: { detail?: string } }).data?.detail || 'Settle failed')
                      : 'Settle failed',
                  );
                }
              }}
            >
              Park for approval
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSettleOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <FormRow label="Amount">
          <TextInput type="number" value={settleAmt} onChange={(e) => setSettleAmt(e.target.value)} />
        </FormRow>
        <FormRow label="Reason">
          <TextInput value={settleReason} onChange={(e) => setSettleReason(e.target.value)} />
        </FormRow>
        <FormRow label="Date">
          <TextInput type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} />
        </FormRow>
      </Modal>

      <Modal
        title="Record refund"
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                setActionError('');
                if (!refundStoreId) {
                  setActionError('Select a cash / bank account');
                  return;
                }
                try {
                  await refundCustomer({
                    id,
                    store_account_id: refundStoreId,
                    amount: Number(refundAmt) || 0,
                    description: refundDesc,
                    voucher_date: refundDate,
                  }).unwrap();
                  setRefundOpen(false);
                  summary.refetch();
                  if (accountId) financeAcct.refetch();
                } catch (e: unknown) {
                  setActionError(
                    e && typeof e === 'object' && 'data' in e
                      ? String((e as { data?: { detail?: string } }).data?.detail || 'Refund failed')
                      : 'Refund failed',
                  );
                }
              }}
            >
              Save refund
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="cd-empty" style={{ padding: '0 0 0.75rem' }}>
          Available credit: {money(s.credit_balance)}
        </p>
        <FormRow label="Cash / Bank account">
          <select
            className="cd-select"
            value={refundStoreId}
            onChange={(e) => setRefundStoreId(e.target.value)}
          >
            <option value="">Select…</option>
            {(storeAccounts.data || []).map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.account_name || a.name || a.id)}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Amount">
          <TextInput type="number" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} />
        </FormRow>
        <FormRow label="Description">
          <TextInput value={refundDesc} onChange={(e) => setRefundDesc(e.target.value)} />
        </FormRow>
        <FormRow label="Date">
          <TextInput type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
        </FormRow>
      </Modal>

      <Modal
        title={blacklisted ? 'Remove blacklist' : 'Blacklist customer'}
        open={blacklistOpen}
        onClose={() => setBlacklistOpen(false)}
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                setActionError('');
                try {
                  await blacklist({
                    id,
                    blacklisted: !blacklisted,
                    reason: blacklisted ? '' : blacklistReason || 'Blocked from UI',
                  }).unwrap();
                  setBlacklistOpen(false);
                  refetch();
                  summary.refetch();
                } catch (e: unknown) {
                  setActionError(
                    e && typeof e === 'object' && 'data' in e
                      ? String((e as { data?: { detail?: string } }).data?.detail || 'Blacklist failed')
                      : 'Blacklist failed',
                  );
                }
              }}
            >
              Confirm
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBlacklistOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {!blacklisted ? (
          <FormRow label="Reason">
            <TextInput value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} />
          </FormRow>
        ) : (
          <p>Remove blacklist from this customer?</p>
        )}
      </Modal>
    </EntityDetailPage>
  );
}

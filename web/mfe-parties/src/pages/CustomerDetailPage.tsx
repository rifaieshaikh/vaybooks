import { Button, ErrorText, FormRow, TextInput } from '@vaybooks/ui-kit';
import {
  useBlacklistCustomerMutation,
  useCan,
  useGetBoutiqueCustomerRelatedSummaryQuery,
  useGetCustomerQuery,
  useGetCustomerSummaryQuery,
  useGetFinanceAccountQuery,
  useGetProjectsCustomerRelatedSummaryQuery,
  useGetSalesCustomerProductHistoryQuery,
  useGetSalesCustomerRelatedSummaryQuery,
  useListCustomerPricesQuery,
  useListPartySegmentsQuery,
  useSettleCustomerMutation,
  useUpdateCustomerMutation,
} from '@vaybooks/store';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  CustomerFormFields,
  customerBody,
  customerToForm,
  emptyCustomerForm,
  validateCustomerForm,
} from '../components/CustomerFormFields';
import { CustomerPricingPanel } from '../components/CustomerPricingPanel';
import { Modal } from '../components/Modal';
import { type PartyFormValues } from '../components/PartyFields';
import './CustomerDetail.css';

type TabId = 'overview' | 'activity' | 'finance' | 'products' | 'prices' | 'pricing';

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
  const raw = String(r.sale_date || r.order_date || r.created_at || r.start_date || r.date || '—');
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

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const canEdit = can('parties.customers.edit');
  const canBlacklist = can('parties.customers.blacklist');
  const canFinance = can('parties.customers.finance.view');
  const canSettle = can('parties.customers.finance.settle');
  const canInsights = can('parties.customers.insights.view');
  const canAccounts = can('finance.accounts.view');
  const canProducts = can('sales.invoices.view');
  const canPrices = can('inventory.customer_prices.view');
  const canPricing =
    can('settings.discounts.view') ||
    can('inventory.customer_prices.view') ||
    can('settings.discounts.edit') ||
    can('inventory.customer_prices.edit');
  const canBoutiqueCreate = can('boutique.orders.create');
  const canProjectCreate = can('projects.projects.create');
  const canProjectView = can('projects.projects.view');
  const canEnquiryCreate = can('projects.enquiries.create');
  const canSoCreate = can('sales.orders.create');
  const canInvCreate = can('sales.invoices.create');
  const canReceiptCreate = can('finance.receipts.create');

  const { data, isLoading, error, refetch } = useGetCustomerQuery(id, { skip: !id });
  const summary = useGetCustomerSummaryQuery(id, { skip: !id });
  const salesRel = useGetSalesCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
  const boutiqueRel = useGetBoutiqueCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
  const projectsRel = useGetProjectsCustomerRelatedSummaryQuery(id, { skip: !id || !canInsights });
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

  const [updateCustomer] = useUpdateCustomerMutation();
  const [blacklist] = useBlacklistCustomerMutation();
  const [settle] = useSettleCustomerMutation();

  const [tab, setTab] = useState<TabId>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [settleAmt, setSettleAmt] = useState('0');
  const [settleReason, setSettleReason] = useState('Uncollectible balance');
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [blacklistReason, setBlacklistReason] = useState('');
  const [values, setValues] = useState<PartyFormValues>(emptyCustomerForm());
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

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
      <div className="cd-page">
        <p className="cd-empty">Loading customer…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="cd-page">
        <Link className="cd-back" to="/parties/customers">
          ← Customers
        </Link>
        <p style={{ color: '#a12828' }}>Customer not found.</p>
      </div>
    );
  }

  const segmentIds = Array.isArray(data.segment_ids) ? (data.segment_ids as string[]).map(String) : [];
  const segmentLabels = segmentIds
    .map((sid) => segmentOptions.find((s) => s.id === sid)?.name || sid)
    .filter(Boolean);
  const s = summary.data || {};
  const blacklisted = Boolean(data.is_blacklisted);

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

  const qaCreates = !blacklisted
    ? [
        canBoutiqueCreate
          ? { label: 'Customization Order', to: `/boutique/orders/workspace?customer_id=${encodeURIComponent(id)}` }
          : null,
        canEnquiryCreate
          ? {
              label: 'Project Enquiry',
              to: `/projects/enquiries?customer_id=${encodeURIComponent(id)}&new=1`,
            }
          : null,
        canProjectCreate
          ? { label: 'Project', to: `/projects/list?customer_id=${encodeURIComponent(id)}&new=1` }
          : null,
        canProjectView
          ? { label: 'View Projects', to: `/projects/list?customer_id=${encodeURIComponent(id)}` }
          : null,
        canSoCreate
          ? { label: 'Sales Order', to: `/sales/orders?customer_id=${encodeURIComponent(id)}&new=1` }
          : null,
        canInvCreate
          ? { label: 'Sales Invoice', to: `/sales/invoices?customer_id=${encodeURIComponent(id)}&new=1` }
          : null,
        canReceiptCreate && accountId
          ? {
              label: 'Receipt',
              to: `/finance/receipts?customer_account_id=${encodeURIComponent(accountId)}&new=1`,
            }
          : null,
      ].filter(Boolean)
    : canProjectView
      ? [{ label: 'View Projects', to: `/projects/list?customer_id=${encodeURIComponent(id)}` }]
      : [];
  const showQa = qaCreates.length > 0 || canSettle || blacklisted;

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'activity', label: 'Activity', show: canInsights },
    { id: 'finance', label: 'Finance', show: canFinance },
    { id: 'products', label: 'Products', show: canProducts },
    { id: 'prices', label: 'Prices', show: canPrices },
    { id: 'pricing', label: 'Pricing', show: canPricing },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'overview';

  function openSettle() {
    setSettleAmt(String(s.receivable_balance ?? s.open_invoice_outstanding ?? 0));
    setSettleOpen(true);
  }

  return (
    <div className="cd-page">
      <Link className="cd-back" to="/parties/customers">
        ← Customers
      </Link>

      <header className="cd-hero">
        <div className="cd-hero-top">
          <div className="cd-identity">
            <p className="cd-kicker">Customer profile</p>
            <div className="cd-name-row">
              <h1 className="cd-name">{String(data.customer_name)}</h1>
              <span className={`cd-status ${blacklisted ? 'cd-status-bad' : 'cd-status-ok'}`}>
                {blacklisted ? 'Blacklisted' : 'Active'}
              </span>
            </div>
            <p className="cd-meta">
              {String(data.phone_number || 'No phone on file')}
              {data.email ? ` · ${String(data.email)}` : ''}
              {data.gstin ? ` · GSTIN ${String(data.gstin)}` : ''}
            </p>
            {segmentLabels.length > 0 ? (
              <div className="cd-segments">
                {segmentLabels.map((label) => (
                  <span className="cd-chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="cd-hero-actions">
            {canEdit ? (
              <Button
                onClick={() => {
                  setValues(customerToForm(data));
                  setFormError('');
                  setEditOpen(true);
                }}
              >
                Edit
              </Button>
            ) : null}
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
          </div>
        </div>

        {canFinance ? (
          <div className="cd-finance">
            <div>
              <p className="cd-outstanding-label">Outstanding</p>
              <p className={`cd-outstanding-value ${outstandingDue ? 'is-due' : 'is-clear'}`}>
                {money(s.open_invoice_outstanding ?? s.receivable_balance)}
              </p>
            </div>
            <div className="cd-finance-side">
              <div className="cd-finance-side-item">
                <span>Balance</span>
                <strong>{money(s.balance)}</strong>
              </div>
              <div className="cd-finance-side-item">
                <span>Credit</span>
                <strong>{money(s.credit_balance)}</strong>
              </div>
              <div className="cd-finance-side-item">
                <span>Advance</span>
                <strong>{money(s.advance)}</strong>
              </div>
              <div className="cd-finance-side-item">
                <span>Parked</span>
                <strong>{money(s.parked_settlement)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {showQa ? (
        <section className="cd-qa" aria-label="Quick actions">
          <div className="cd-qa-head">
            <h3>Quick Actions</h3>
            {blacklisted ? (
              <p className="cd-qa-caption">Creates are blocked while blacklisted — Settle remains available.</p>
            ) : null}
          </div>
          <div className="cd-qa-row">
            {(qaCreates as { label: string; to: string }[]).map((a, i) => (
              <Link key={a.to} className={`cd-qa-btn${i === 0 ? ' is-primary' : ''}`} to={a.to}>
                {a.label}
              </Link>
            ))}
            {canSettle ? (
              <button type="button" className="cd-qa-btn" onClick={openSettle}>
                Settle
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {actionError ? <ErrorText>{actionError}</ErrorText> : null}

      {visibleTabs.length > 1 ? (
        <nav className="cd-tabs" aria-label="Customer sections">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cd-tab${activeTab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}

      {activeTab === 'overview' ? (
        <div className="cd-panel" key="overview">
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
        </div>
      ) : null}

      {activeTab === 'activity' && canInsights ? (
        <div className="cd-panel cd-activity" key="activity">
          <ActivityBlock title="Recent sales" rows={(salesRel.data?.recent as Record<string, unknown>[]) || []} />
          <ActivityBlock
            title="Recent boutique orders"
            rows={(boutiqueRel.data?.recent as Record<string, unknown>[]) || []}
          />
          <ActivityBlock
            title="Recent projects"
            rows={(projectsRel.data?.recent as Record<string, unknown>[]) || []}
          />
        </div>
      ) : null}

      {activeTab === 'finance' && canFinance ? (
        <div className="cd-panel" key="finance">
          <div className="cd-ledger-head">
            <h3>Ledger (Finance)</h3>
            {accountId && canAccounts ? (
              <Link className="cd-text-link" to={`/finance/accounts/${accountId}`}>
                Open full account
              </Link>
            ) : null}
          </div>
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
        </div>
      ) : null}

      {activeTab === 'products' && canProducts ? (
        <div className="cd-panel" key="products">
          <div className="cd-ledger-head">
            <h3>Ledger (Product)</h3>
          </div>
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
        </div>
      ) : null}

      {activeTab === 'prices' && canPrices ? (
        <div className="cd-panel" key="prices">
          <div className="cd-ledger-head">
            <h3>Price ledger</h3>
            {canPricing ? (
              <button type="button" className="cd-text-link" onClick={() => setTab('pricing')}>
                Add rate
              </button>
            ) : null}
          </div>
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
          {can('settings.discounts.view') ? (
            <p className="cd-ledger-foot">
              <button type="button" className="cd-text-link" onClick={() => setTab('pricing')}>
                Manage discounts on Pricing
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'pricing' && canPricing ? (
        <div className="cd-panel" key="pricing">
          <CustomerPricingPanel
            customerId={id}
            customerName={String(data.customer_name || '')}
            segmentIds={segmentIds}
            onSeeAllPrices={canPrices ? () => setTab('prices') : undefined}
          />
        </div>
      ) : null}

      <Modal
        title="Edit Customer"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <Button
              type="button"
              onClick={async () => {
                const validation = validateCustomerForm(values);
                if (validation) {
                  setFormError(validation);
                  return;
                }
                setFormError('');
                try {
                  await updateCustomer({ id, body: customerBody(values) }).unwrap();
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
    </div>
  );
}

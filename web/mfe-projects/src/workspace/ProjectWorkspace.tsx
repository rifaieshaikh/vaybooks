import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  useAcceptProjectQuotationMutation,
  useAddProjectBudgetLineMutation,
  useApproveProjectRaBillMutation,
  useApproveProjectVariationMutation,
  useCertifyProjectMeasurementMutation,
  useCertifyProjectRaBillMutation,
  useConvertProjectRaToInvoiceMutation,
  useCreateProjectActivityMutation,
  useCreateProjectBoqItemMutation,
  useCreateProjectDprMutation,
  useCreateProjectExpenseMutation,
  useCreateProjectMeasurementMutation,
  useCreateProjectProformaMutation,
  useCreateProjectQuotationMutation,
  useCreateProjectRaBillMutation,
  useCreateProjectReceiptMutation,
  useCreateProjectTimeEntryMutation,
  useCreateProjectVariationMutation,
  useCreateProjectVendorPaymentMutation,
  useCreateProjectWorkOrderMutation,
  useDraftProjectRecognitionMutation,
  usePostProjectRecognitionMutation,
  useApproveProjectRecognitionMutation,
  useCreateProjectReconciliationMutation,
  useGetProjectAccountingSummaryQuery,
  useGetProjectBudgetQuery,
  useGetProjectClosureBlockersQuery,
  useGetProjectCostsQuery,
  useGetProjectProfitabilityQuery,
  useGetProjectQuery,
  useGetProjectWorkspaceQuery,
  useListFinanceAccountsQuery,
  useListProjectActivitiesQuery,
  useListProjectBoqQuery,
  useListProjectDocumentsQuery,
  useListProjectDprQuery,
  useListProjectInvoicesQuery,
  useListProjectMeasurementsQuery,
  useListProjectProformasQuery,
  useListProjectQuotationsQuery,
  useListProjectRaBillsQuery,
  useListProjectRecognitionQuery,
  useListProjectReconciliationsQuery,
  useListProjectRetentionsQuery,
  useListProjectTimeQuery,
  useListProjectVariationsQuery,
  useListProjectHistoryQuery,
  useListProjectVouchersQuery,
  useListProjectWorkOrdersQuery,
  useListWorkersQuery,
  useReleaseProjectRetentionMutation,
  useSendProjectQuotationMutation,
  useSubmitProjectMeasurementMutation,
  useSubmitProjectRaBillMutation,
  useUpdateProjectMutation,
  useUploadProjectDocumentMutation,
  useVerifyProjectMeasurementMutation,
} from '@vaybooks/store';
import {
  Button,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailTabs,
  ErrorText,
  FormRow,
} from '@vaybooks/ui-kit';
import { asCaption, extractError, formatDateInput, formatMoney } from '../utils';

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'boq', label: 'BOQ' },
  { id: 'budget', label: 'Budget' },
  { id: 'time', label: 'Time' },
  { id: 'costs', label: 'Costs' },
  { id: 'documents', label: 'Documents' },
  { id: 'dpr', label: 'DPR' },
  { id: 'billing', label: 'Billing' },
  { id: 'money', label: 'Money' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'profit', label: 'Profit' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof PRIMARY_TABS)[number]['id'];

const BILLING_SUBTABS = [
  'Quotations',
  'Work Orders',
  'Measurements',
  'RA Bills',
  'Tax Invoices',
  'Proforma',
  'Variations',
] as const;

type BillingSub = (typeof BILLING_SUBTABS)[number];

function Msg({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|required|unavailable|invalid/i.test(text);
  return (
    <p style={{ margin: '0 0 12px', color: bad ? 'var(--vb-color-danger, #b42318)' : 'inherit' }}>
      {text}
    </p>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (!rows.length) return <p style={{ margin: 0, color: '#667' }}>{empty}</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j} style={{ padding: '8px 10px', borderBottom: '1px solid #f0f1f3' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [billingSub, setBillingSub] = useState<BillingSub>('RA Bills');
  const [msg, setMsg] = useState('');

  const { data: project } = useGetProjectQuery(projectId);
  const { data: workspace } = useGetProjectWorkspaceQuery(projectId);
  const { data: summary } = useGetProjectAccountingSummaryQuery(projectId);
  const { data: blockers = [] } = useGetProjectClosureBlockersQuery(projectId, {
    skip: tab !== 'overview',
  });
  const { data: activities = [] } = useListProjectActivitiesQuery(projectId, {
    skip: tab !== 'work' && tab !== 'time',
  });
  const { data: boq = [] } = useListProjectBoqQuery(projectId, {
    skip: tab !== 'boq' && !(tab === 'billing' && billingSub === 'Measurements'),
  });
  const { data: budget } = useGetProjectBudgetQuery(projectId, {
    skip: tab !== 'budget' && tab !== 'overview',
  });
  const { data: measurements = [] } = useListProjectMeasurementsQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Measurements',
  });
  const { data: ra = [] } = useListProjectRaBillsQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'RA Bills',
  });
  const { data: time = [] } = useListProjectTimeQuery(projectId, { skip: tab !== 'time' });
  const { data: costs } = useGetProjectCostsQuery(projectId, { skip: tab !== 'costs' });
  const { data: docs = [] } = useListProjectDocumentsQuery(projectId, {
    skip: tab !== 'documents',
  });
  const { data: dprs = [] } = useListProjectDprQuery(projectId, { skip: tab !== 'dpr' });
  const { data: quotations = [] } = useListProjectQuotationsQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Quotations',
  });
  const { data: workOrders = [] } = useListProjectWorkOrdersQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Work Orders',
  });
  const { data: invoices = [] } = useListProjectInvoicesQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Tax Invoices',
  });
  const { data: proformas = [] } = useListProjectProformasQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Proforma',
  });
  const { data: variations = [] } = useListProjectVariationsQuery(projectId, {
    skip: tab !== 'billing' || billingSub !== 'Variations',
  });
  const { data: vouchers = [] } = useListProjectVouchersQuery(projectId, {
    skip: tab !== 'ledger',
  });
  const { data: retentions = [] } = useListProjectRetentionsQuery(projectId, {
    skip: tab !== 'money',
  });
  const { data: recognition = [] } = useListProjectRecognitionQuery(projectId, {
    skip: tab !== 'ledger',
  });
  const { data: reconciliations = [] } = useListProjectReconciliationsQuery(projectId, {
    skip: tab !== 'ledger',
  });
  const { data: profitability } = useGetProjectProfitabilityQuery(projectId, {
    skip: tab !== 'profit',
  });
  const { data: history = [] } = useListProjectHistoryQuery(
    { id: projectId, limit: 200 },
    { skip: tab !== 'history' },
  );
  const { data: workers = [] } = useListWorkersQuery(
    { active_only: true },
    { skip: tab !== 'time' },
  );
  const { data: accounts = [] } = useListFinanceAccountsQuery(undefined, {
    skip: tab !== 'billing' && tab !== 'money',
  });

  const [updateProject] = useUpdateProjectMutation();
  const [createActivity] = useCreateProjectActivityMutation();
  const [createBoq] = useCreateProjectBoqItemMutation();
  const [addBudget] = useAddProjectBudgetLineMutation();
  const [createTime] = useCreateProjectTimeEntryMutation();
  const [createExpense] = useCreateProjectExpenseMutation();
  const [uploadDoc] = useUploadProjectDocumentMutation();
  const [createDpr] = useCreateProjectDprMutation();
  const [createQuote] = useCreateProjectQuotationMutation();
  const [sendQuote] = useSendProjectQuotationMutation();
  const [acceptQuote] = useAcceptProjectQuotationMutation();
  const [createWo] = useCreateProjectWorkOrderMutation();
  const [createMeas] = useCreateProjectMeasurementMutation();
  const [submitMeas] = useSubmitProjectMeasurementMutation();
  const [verifyMeas] = useVerifyProjectMeasurementMutation();
  const [certifyMeas] = useCertifyProjectMeasurementMutation();
  const [createRa] = useCreateProjectRaBillMutation();
  const [submitRa] = useSubmitProjectRaBillMutation();
  const [certifyRa] = useCertifyProjectRaBillMutation();
  const [approveRa] = useApproveProjectRaBillMutation();
  const [convertRa] = useConvertProjectRaToInvoiceMutation();
  const [createProforma] = useCreateProjectProformaMutation();
  const [createVariation] = useCreateProjectVariationMutation();
  const [approveVariation] = useApproveProjectVariationMutation();
  const [createReceipt] = useCreateProjectReceiptMutation();
  const [createVendorPayment] = useCreateProjectVendorPaymentMutation();
  const [releaseRetention] = useReleaseProjectRetentionMutation();
  const [draftRecognition] = useDraftProjectRecognitionMutation();
  const [approveRecognition] = useApproveProjectRecognitionMutation();
  const [postRecognition] = usePostProjectRecognitionMutation();
  const [createReconciliation] = useCreateProjectReconciliationMutation();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [activityName, setActivityName] = useState('');
  const [boqDesc, setBoqDesc] = useState('');
  const [boqQty, setBoqQty] = useState('1');
  const [boqRate, setBoqRate] = useState('0');
  const [budgetAmt, setBudgetAmt] = useState('');
  const [budgetCat, setBudgetCat] = useState('General');
  const [expenseAmt, setExpenseAmt] = useState('');
  const [timeHours, setTimeHours] = useState('1');
  const [timeActivityId, setTimeActivityId] = useState('');
  const [timeWorkerId, setTimeWorkerId] = useState('');
  const [docCategory, setDocCategory] = useState('general');
  const [docUploading, setDocUploading] = useState(false);
  const [raAmount, setRaAmount] = useState('');
  const [storeAccountId, setStoreAccountId] = useState('');
  const [receivingAccountId, setReceivingAccountId] = useState('');
  const [customerAccountId, setCustomerAccountId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [vendorAccountId, setVendorAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [payingAccountId, setPayingAccountId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [quoteDesc, setQuoteDesc] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [variationValue, setVariationValue] = useState('');
  const [variationReason, setVariationReason] = useState('');
  const [proformaAmount, setProformaAmount] = useState('');
  const [retentionPct, setRetentionPct] = useState('');
  const [measBoqId, setMeasBoqId] = useState('');
  const [measQty, setMeasQty] = useState('1');

  const expenses = useMemo(() => {
    const rows = costs?.expenses;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }, [costs]);

  const workerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workers) {
      const id = String(w.id || '');
      if (!id) continue;
      map.set(id, asCaption(w.worker_name || w.name) || id);
    }
    return map;
  }, [workers]);

  useEffect(() => {
    if (!timeWorkerId && workers.length > 0) {
      setTimeWorkerId(String(workers[0].id || ''));
    }
  }, [workers, timeWorkerId]);

  const budgetLines = Array.isArray(budget?.lines)
    ? (budget!.lines as Record<string, unknown>[])
    : [];
  const budgetSummary = (budget?.summary || summary?.budget || {}) as Record<string, unknown>;

  const metricItems = useMemo(() => {
    const summaryRec = (summary || {}) as Record<string, unknown>;
    const party = (summaryRec.party_balances || summaryRec.party || {}) as Record<
      string,
      unknown
    >;
    const wipRec = (summaryRec.wip_balances || summaryRec.wip || {}) as Record<
      string,
      unknown
    >;
    const contract =
      project?.contract_value ?? summaryRec.contract_value ?? wipRec.contract_value;
    const budgetVal =
      budgetSummary.revised_total ??
      budgetSummary.budget_total ??
      budgetSummary.total_budget ??
      budgetSummary.budget;
    const actual =
      budgetSummary.actual ??
      budgetSummary.actual_total ??
      summaryRec.total_cost ??
      wipRec.total_cost;
    const billed =
      summaryRec.billed ?? wipRec.billed_revenue ?? party.customer_outstanding;
    const retention = summaryRec.retention ?? summaryRec.retention_total;
    const wip =
      wipRec.unbilled_cost ?? summaryRec.wip_unbilled ?? wipRec.wip_balance;
    const progressVal = summaryRec.progress ?? workspace?.progress ?? project?.progress;
    return [
      { label: 'Contract', value: formatMoney(contract) },
      { label: 'Budget', value: formatMoney(budgetVal) },
      { label: 'Actual cost', value: formatMoney(actual) },
      { label: 'Billed', value: formatMoney(billed) },
      { label: 'Retention', value: formatMoney(retention) },
      {
        label: 'Progress',
        value:
          progressVal != null && progressVal !== ''
            ? `${Number(progressVal).toFixed(1)}%`
            : '—',
      },
      ...(wip != null ? [{ label: 'Unbilled WIP', value: formatMoney(wip) }] : []),
    ];
  }, [project, summary, budgetSummary, workspace]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setMsg('');
    try {
      await fn();
      setMsg(label);
    } catch (e) {
      setMsg(extractError(e));
    }
  }

  useEffect(() => {
    if (!project) return;
    setStartDate(formatDateInput(project.start_date));
    setEndDate(formatDateInput(project.expected_end_date));
    setStatus(String(project.status || ''));
    setRetentionPct(
      project.retention_pct != null && project.retention_pct !== ''
        ? String(project.retention_pct)
        : '',
    );
  }, [project]);

  const accountOptions = accounts as Record<string, unknown>[];

  return (
    <>
      <EntityDetailSnapshot ariaLabel="Project control metrics" items={metricItems} />

      <EntityDetailTabs
        value={tab}
        ariaLabel="Project workspace sections"
        onChange={(next) => setTab(next as TabId)}
        options={[...PRIMARY_TABS]}
      />

      <Msg text={msg} />

      {tab === 'overview' ? (
        <EntityDetailPanel title="Overview">
          <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
            <p style={{ margin: 0, color: '#667' }}>
              Measurements{' '}
              {Array.isArray(workspace?.measurements)
                ? workspace!.measurements.length
                : measurements.length}{' '}
              · RA {Array.isArray(workspace?.ra_bills) ? workspace!.ra_bills.length : ra.length} ·
              Docs {Array.isArray(workspace?.documents) ? workspace!.documents.length : docs.length}
            </p>
            {Array.isArray(blockers) && blockers.length > 0 ? (
              <div>
                <strong>Closure blockers</strong>
                <ul>
                  {blockers.map((b, i) => (
                    <li key={i}>
                      {typeof b === 'string'
                        ? b
                        : asCaption((b as Record<string, unknown>).message || (b as Record<string, unknown>).reason || JSON.stringify(b))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#667' }}>No closure blockers.</p>
            )}
            <FormRow label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {[
                  'Draft',
                  'Planned',
                  'Active',
                  'On Hold',
                  'Physically Completed',
                  'DLP',
                  'Financially Closed',
                  'Cancelled',
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormRow>
            <FormRow label="Expected end">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormRow>
            <Button
              type="button"
              onClick={() =>
                run('Overview saved', () =>
                  updateProject({
                    id: projectId,
                    body: {
                      status: status || undefined,
                      start_date: startDate || undefined,
                      expected_end_date: endDate || undefined,
                    },
                  }).unwrap(),
                )
              }
            >
              Save overview
            </Button>
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'work' ? (
        <EntityDetailPanel title="Work / WBS">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Activity name">
                <input value={activityName} onChange={(e) => setActivityName(e.target.value)} />
              </FormRow>
              <Button
                type="button"
                disabled={!activityName.trim()}
                onClick={() =>
                  run('Activity added', async () => {
                    await createActivity({
                      projectId,
                      body: { name: activityName.trim() },
                    }).unwrap();
                    setActivityName('');
                  })
                }
              >
                Add activity
              </Button>
            </div>
            <SimpleTable
              headers={['Name', '%', 'Weight', 'Status', 'Planned']}
              empty="No activities yet."
              rows={activities.map((a) => [
                asCaption(a.name),
                asCaption(a.percent_complete),
                asCaption(a.weightage),
                asCaption(a.status),
                [formatDateInput(a.planned_start), formatDateInput(a.planned_end)]
                  .filter((x) => x)
                  .join(' → ') || '—',
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'boq' ? (
        <EntityDetailPanel title="BOQ">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Description">
                <input value={boqDesc} onChange={(e) => setBoqDesc(e.target.value)} />
              </FormRow>
              <FormRow label="Qty">
                <input value={boqQty} onChange={(e) => setBoqQty(e.target.value)} />
              </FormRow>
              <FormRow label="Rate">
                <input value={boqRate} onChange={(e) => setBoqRate(e.target.value)} />
              </FormRow>
              <Button
                type="button"
                disabled={!boqDesc.trim()}
                onClick={() =>
                  run('BOQ item added', async () => {
                    await createBoq({
                      projectId,
                      body: {
                        code: `B${boq.length + 1}`,
                        description: boqDesc.trim(),
                        qty: Number(boqQty) || 0,
                        rate: Number(boqRate) || 0,
                      },
                    }).unwrap();
                    setBoqDesc('');
                  })
                }
              >
                Add BOQ item
              </Button>
            </div>
            <SimpleTable
              headers={['Code', 'Description', 'Qty', 'Rate']}
              empty="No BOQ items."
              rows={boq.map((row) => [
                asCaption(row.code),
                asCaption(row.description),
                asCaption(row.estimated_qty ?? row.qty),
                formatMoney(row.selling_rate ?? row.rate),
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'budget' ? (
        <EntityDetailPanel title="Budget">
          <div style={{ display: 'grid', gap: 12 }}>
            <EntityDetailSnapshot
              ariaLabel="Budget summary"
              items={[
                {
                  label: 'Budget',
                  value: formatMoney(
                    budgetSummary.revised_total ??
                      budgetSummary.budget_total ??
                      budgetSummary.total_budget,
                  ),
                },
                {
                  label: 'Committed',
                  value: formatMoney(budgetSummary.committed ?? budgetSummary.committed_total),
                },
                {
                  label: 'Actual',
                  value: formatMoney(budgetSummary.actual ?? budgetSummary.actual_total),
                },
                {
                  label: 'Remaining',
                  value: formatMoney(budgetSummary.remaining ?? budgetSummary.forecast_etc),
                },
              ]}
            />
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Category">
                <input value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)} />
              </FormRow>
              <FormRow label="Amount">
                <input
                  value={budgetAmt}
                  onChange={(e) => setBudgetAmt(e.target.value)}
                  placeholder="0"
                />
              </FormRow>
              <Button
                type="button"
                disabled={!budgetAmt}
                onClick={() =>
                  run('Budget line added', async () => {
                    await addBudget({
                      projectId,
                      body: {
                        cost_category: budgetCat || 'General',
                        amount: Number(budgetAmt) || 0,
                      },
                    }).unwrap();
                    setBudgetAmt('');
                  })
                }
              >
                Add budget line
              </Button>
            </div>
            <SimpleTable
              headers={['Category', 'Original', 'Revised']}
              empty="No budget lines."
              rows={budgetLines.map((line) => [
                asCaption(line.cost_category),
                formatMoney(line.original_amount ?? line.amount),
                formatMoney(line.revised_amount ?? line.amount),
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'time' ? (
        <EntityDetailPanel title="Time">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Activity">
                <select
                  value={timeActivityId}
                  onChange={(e) => setTimeActivityId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {activities.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>
                      {asCaption(a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Worker">
                <select
                  value={timeWorkerId}
                  onChange={(e) => setTimeWorkerId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {workers.map((w) => (
                    <option key={String(w.id)} value={String(w.id)}>
                      {asCaption(w.worker_name || w.name) || String(w.id)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Hours">
                <input value={timeHours} onChange={(e) => setTimeHours(e.target.value)} />
              </FormRow>
              <Button
                type="button"
                disabled={!timeActivityId || !timeWorkerId}
                onClick={() =>
                  run('Time entry added', () =>
                    createTime({
                      projectId,
                      body: {
                        activity_id: timeActivityId,
                        worker_id: timeWorkerId,
                        hours: Number(timeHours) || 0,
                      },
                    }).unwrap(),
                  )
                }
              >
                Add time entry
              </Button>
            </div>
            <SimpleTable
              headers={['Activity', 'Worker', 'Hours', 'Date']}
              empty="No time entries."
              rows={time.map((t) => [
                asCaption(t.activity_id),
                workerNameById.get(String(t.worker_id || '')) || asCaption(t.worker_id),
                asCaption(t.hours),
                formatDateInput(t.work_date) || '—',
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'costs' ? (
        <EntityDetailPanel title="Costs">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Expense amount">
                <input
                  value={expenseAmt}
                  onChange={(e) => setExpenseAmt(e.target.value)}
                  placeholder="0"
                />
              </FormRow>
              <Button
                type="button"
                disabled={!expenseAmt}
                onClick={() =>
                  run('Expense added', async () => {
                    await createExpense({
                      projectId,
                      body: { amount: Number(expenseAmt) || 0, category: 'General' },
                    }).unwrap();
                    setExpenseAmt('');
                  })
                }
              >
                Add expense
              </Button>
            </div>
            <SimpleTable
              headers={['Category', 'Amount', 'Date', 'Description']}
              empty="No expenses."
              rows={expenses.map((e) => [
                asCaption(e.category),
                formatMoney(e.amount),
                formatDateInput(e.expense_date) || '—',
                asCaption(e.description),
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'documents' ? (
        <EntityDetailPanel title="Documents">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <FormRow label="Category">
                <input
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  placeholder="general"
                />
              </FormRow>
              <FormRow label="File">
                <input
                  type="file"
                  disabled={docUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setDocUploading(true);
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = String(reader.result || '');
                      const comma = result.indexOf(',');
                      const dataBase64 = comma >= 0 ? result.slice(comma + 1) : result;
                      void run('Document uploaded', async () => {
                        await uploadDoc({
                          projectId,
                          body: {
                            name: file.name,
                            category: docCategory.trim() || 'general',
                            content_type: file.type || 'application/octet-stream',
                            data_base64: dataBase64,
                          },
                        }).unwrap();
                      }).finally(() => setDocUploading(false));
                    };
                    reader.onerror = () => {
                      setDocUploading(false);
                      setMsg('Could not read file');
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </FormRow>
            </div>
            <SimpleTable
              headers={['Name', 'Category']}
              empty="No documents."
              rows={docs.map((d) => [asCaption(d.name), asCaption(d.category)])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'dpr' ? (
        <EntityDetailPanel title="DPR">
          <div style={{ display: 'grid', gap: 12 }}>
            <Button
              type="button"
              onClick={() =>
                run('DPR created', () =>
                  createDpr({ projectId, body: { notes: 'Site progress', weather: '' } }).unwrap(),
                )
              }
            >
              Add DPR
            </Button>
            <SimpleTable
              headers={['Date', 'Notes', 'Weather']}
              empty="No DPRs."
              rows={dprs.map((d) => [
                formatDateInput(d.report_date) || '—',
                asCaption(d.notes),
                asCaption(d.weather),
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'billing' ? (
        <EntityDetailPanel title="Billing">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {BILLING_SUBTABS.map((s) => (
              <Button
                key={s}
                type="button"
                variant={billingSub === s ? undefined : 'ghost'}
                onClick={() => setBillingSub(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {billingSub === 'Quotations' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
                <FormRow label="Line description">
                  <input value={quoteDesc} onChange={(e) => setQuoteDesc(e.target.value)} />
                </FormRow>
                <FormRow label="Line amount (rate)">
                  <input value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
                </FormRow>
                <Button
                  type="button"
                  onClick={() =>
                    run('Quotation created', async () => {
                      await createQuote({
                        projectId,
                        body: {
                          notes: '',
                          lines: [
                            {
                              description: quoteDesc || 'Quoted work',
                              quantity: 1,
                              rate: Number(quoteAmount) || 0,
                            },
                          ],
                        },
                      }).unwrap();
                      setQuoteDesc('');
                      setQuoteAmount('');
                    })
                  }
                >
                  Create quotation
                </Button>
              </div>
              <SimpleTable
                headers={['Number', 'Status', 'Total', 'Actions']}
                empty="No quotations."
                rows={quotations.map((q) => [
                  asCaption(q.quotation_number),
                  asCaption(q.status),
                  formatMoney(q.total_amount ?? q.grand_total),
                  <span key={String(q.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        run('Quotation sent', () =>
                          sendQuote({ projectId, quotationId: String(q.id) }).unwrap(),
                        )
                      }
                    >
                      Send
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        run('Quotation accepted', () =>
                          acceptQuote({ projectId, quotationId: String(q.id) }).unwrap(),
                        )
                      }
                    >
                      Accept
                    </Button>
                  </span>,
                ])}
              />
            </div>
          ) : null}

          {billingSub === 'Work Orders' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Button
                type="button"
                onClick={() =>
                  run('Work order created', () =>
                    createWo({ projectId, body: { description: 'Work order' } }).unwrap(),
                  )
                }
              >
                Create work order
              </Button>
              <SimpleTable
                headers={['Number', 'Date', 'Description']}
                empty="No work orders."
                rows={workOrders.map((w) => [
                  asCaption(w.wo_number),
                  formatDateInput(w.wo_date) || '—',
                  asCaption(w.description),
                ])}
              />
            </div>
          ) : null}

          {billingSub === 'Measurements' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
                <FormRow label="BOQ item">
                  <select value={measBoqId} onChange={(e) => setMeasBoqId(e.target.value)}>
                    <option value="">Select…</option>
                    {boq.map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>
                        {asCaption(b.code)} · {asCaption(b.description)}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Quantity">
                  <input value={measQty} onChange={(e) => setMeasQty(e.target.value)} />
                </FormRow>
                <Button
                  type="button"
                  disabled={!measBoqId}
                  onClick={() =>
                    run('Measurement created', () =>
                      createMeas({
                        projectId,
                        body: { boq_item_id: measBoqId, quantity: Number(measQty) || 0 },
                      }).unwrap(),
                    )
                  }
                >
                  Add measurement
                </Button>
              </div>
              <SimpleTable
                headers={['Qty', 'Status', 'Actions']}
                empty="No measurements."
                rows={measurements.map((m) => [
                  asCaption(m.quantity),
                  asCaption(m.status),
                  <span key={String(m.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        run('Submitted', () =>
                          submitMeas({ projectId, measurementId: String(m.id) }).unwrap(),
                        )
                      }
                    >
                      Submit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        run('Verified', () =>
                          verifyMeas({
                            projectId,
                            measurementId: String(m.id),
                            body: { actor: 'web' },
                          }).unwrap(),
                        )
                      }
                    >
                      Verify
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        run('Certified', () =>
                          certifyMeas({
                            projectId,
                            measurementId: String(m.id),
                            body: { actor: 'web' },
                          }).unwrap(),
                        )
                      }
                    >
                      Certify
                    </Button>
                  </span>,
                ])}
              />
            </div>
          ) : null}

          {billingSub === 'RA Bills' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
                <FormRow label="Claim amount">
                  <input value={raAmount} onChange={(e) => setRaAmount(e.target.value)} />
                </FormRow>
                <Button
                  type="button"
                  disabled={!raAmount}
                  onClick={() =>
                    run('RA created', async () => {
                      await createRa({
                        projectId,
                        body: { claim_amount: Number(raAmount) || 0, description: 'RA claim' },
                      }).unwrap();
                      setRaAmount('');
                    })
                  }
                >
                  Create RA
                </Button>
                <FormRow label="Store account (for convert)">
                  <select
                    value={storeAccountId}
                    onChange={(e) => setStoreAccountId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {accountOptions.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {asCaption(a.account_name || a.name)}
                      </option>
                    ))}
                  </select>
                </FormRow>
              </div>
              <SimpleTable
                headers={['Number', 'Status', 'Claim', 'Certified', 'Actions']}
                empty="No RA bills."
                rows={ra.map((bill) => {
                  const status = String(bill.status || '');
                  const canSubmit = status === 'Draft';
                  const canCertify =
                    status === 'Draft' || status === 'Submitted' || status === 'Claimed';
                  const canApprove = status === 'Certified' || status === 'Partially Certified';
                  const canConvert =
                    status === 'Certified' || status === 'Partially Certified';
                  return [
                    asCaption(bill.ra_number),
                    asCaption(bill.status),
                    formatMoney(bill.claim_amount ?? bill.gross_claim),
                    formatMoney(bill.gross_certified),
                    <span key={String(bill.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {canSubmit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            run('RA submitted', () =>
                              submitRa({ projectId, raId: String(bill.id) }).unwrap(),
                            )
                          }
                        >
                          Submit
                        </Button>
                      ) : null}
                      {canCertify ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            run('RA certified', () =>
                              certifyRa({ projectId, raId: String(bill.id) }).unwrap(),
                            )
                          }
                        >
                          Certify
                        </Button>
                      ) : null}
                      {canApprove ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            run('RA approved', () =>
                              approveRa({ projectId, raId: String(bill.id) }).unwrap(),
                            )
                          }
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canConvert ? (
                        <Button
                          type="button"
                          disabled={!storeAccountId}
                          onClick={() =>
                            run('Converted to invoice', () =>
                              convertRa({
                                projectId,
                                raId: String(bill.id),
                                body: { store_account_id: storeAccountId },
                              }).unwrap(),
                            )
                          }
                        >
                          Convert to invoice
                        </Button>
                      ) : null}
                      {!canSubmit && !canCertify && !canApprove && !canConvert ? (
                        <span className="el-muted">—</span>
                      ) : null}
                    </span>,
                  ];
                })}
              />
              {!accountOptions.length ? (
                <ErrorText>
                  No finance accounts loaded. Configure chart of accounts before converting RA to
                  invoice.
                </ErrorText>
              ) : null}
            </div>
          ) : null}

          {billingSub === 'Tax Invoices' ? (
            <SimpleTable
              headers={['Number', 'Type', 'Amount', 'Date', 'Open']}
              empty="No project invoices yet. Convert a certified RA."
              rows={invoices.map((inv) => [
                asCaption(inv.voucher_number || inv.store_invoice_number),
                asCaption(inv.voucher_type),
                formatMoney(inv.total_amount ?? inv.amount),
                formatDateInput(inv.voucher_date) || '—',
                <Link
                  key={String(inv.id)}
                  to={`/finance/vouchers/${String(inv.id)}`}
                  title={String(inv.voucher_number || inv.id)}
                >
                  Open
                </Link>,
              ])}
            />
          ) : null}

          {billingSub === 'Proforma' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
                <FormRow label="Amount">
                  <input
                    value={proformaAmount}
                    onChange={(e) => setProformaAmount(e.target.value)}
                  />
                </FormRow>
                <Button
                  type="button"
                  disabled={!proformaAmount}
                  onClick={() =>
                    run('Proforma created', async () => {
                      await createProforma({
                        projectId,
                        body: {
                          amount: Number(proformaAmount) || 0,
                          description: 'Proforma',
                        },
                      }).unwrap();
                      setProformaAmount('');
                    })
                  }
                >
                  Create proforma
                </Button>
              </div>
              <SimpleTable
                headers={['Number', 'Amount', 'Date']}
                empty="No proformas."
                rows={proformas.map((p) => [
                  asCaption(p.proforma_number),
                  formatMoney(p.amount),
                  formatDateInput(p.proforma_date) || '—',
                ])}
              />
            </div>
          ) : null}

          {billingSub === 'Variations' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
                <FormRow label="New contract value">
                  <input
                    value={variationValue}
                    onChange={(e) => setVariationValue(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Reason">
                  <input
                    value={variationReason}
                    onChange={(e) => setVariationReason(e.target.value)}
                  />
                </FormRow>
                <Button
                  type="button"
                  disabled={!variationReason.trim() || !variationValue}
                  onClick={() =>
                    run('Variation created', async () => {
                      await createVariation({
                        projectId,
                        body: {
                          new_contract_value: Number(variationValue) || 0,
                          reason: variationReason.trim(),
                        },
                      }).unwrap();
                      setVariationReason('');
                      setVariationValue('');
                    })
                  }
                >
                  Create variation
                </Button>
              </div>
              <SimpleTable
                headers={['Number', 'Status', 'New value', 'Reason', 'Actions']}
                empty="No variations."
                rows={variations.map((v) => [
                  asCaption(v.variation_number),
                  asCaption(v.status),
                  formatMoney(v.new_contract_value),
                  asCaption(v.reason),
                  <Button
                    key={String(v.id)}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      run('Variation approved', () =>
                        approveVariation({
                          projectId,
                          variationId: String(v.id),
                        }).unwrap(),
                      )
                    }
                  >
                    Approve
                  </Button>,
                ])}
              />
            </div>
          ) : null}
        </EntityDetailPanel>
      ) : null}

      {tab === 'money' ? (
        <EntityDetailPanel title="Money">
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
              <strong>Customer receipt</strong>
              <FormRow label="Receiving account">
                <select
                  value={receivingAccountId}
                  onChange={(e) => setReceivingAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accountOptions.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>
                      {asCaption(a.account_name || a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Customer account">
                <select
                  value={customerAccountId}
                  onChange={(e) => setCustomerAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accountOptions.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>
                      {asCaption(a.account_name || a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Amount">
                <input value={receiptAmount} onChange={(e) => setReceiptAmount(e.target.value)} />
              </FormRow>
              <Button
                type="button"
                disabled={!receivingAccountId || !customerAccountId || !receiptAmount}
                onClick={() =>
                  run('Receipt recorded', () =>
                    createReceipt({
                      projectId,
                      body: {
                        receiving_account_id: receivingAccountId,
                        customer_account_id: customerAccountId,
                        amount: Number(receiptAmount) || 0,
                        description: 'Project receipt',
                      },
                    }).unwrap(),
                  )
                }
              >
                Record receipt
              </Button>
            </div>

            <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
              <strong>Vendor payment</strong>
              <FormRow label="Vendor account">
                <select
                  value={vendorAccountId}
                  onChange={(e) => setVendorAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accountOptions.map((a) => (
                    <option key={`v-${String(a.id)}`} value={String(a.id)}>
                      {asCaption(a.account_name || a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Expense account">
                <select
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accountOptions.map((a) => (
                    <option key={`e-${String(a.id)}`} value={String(a.id)}>
                      {asCaption(a.account_name || a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Paying account">
                <select
                  value={payingAccountId}
                  onChange={(e) => setPayingAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accountOptions.map((a) => (
                    <option key={`p-${String(a.id)}`} value={String(a.id)}>
                      {asCaption(a.account_name || a.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Amount">
                <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </FormRow>
              <Button
                type="button"
                disabled={
                  !vendorAccountId || !expenseAccountId || !payingAccountId || !paymentAmount
                }
                onClick={() =>
                  run('Vendor payment recorded', () =>
                    createVendorPayment({
                      projectId,
                      body: {
                        vendor_account_id: vendorAccountId,
                        expense_account_id: expenseAccountId,
                        paying_account_id: payingAccountId,
                        amount: Number(paymentAmount) || 0,
                        description: 'Project vendor payment',
                      },
                    }).unwrap(),
                  )
                }
              >
                Record vendor payment
              </Button>
            </div>

            <div>
              <strong>Retention</strong>
              <SimpleTable
                headers={['Withheld', 'Released', 'Actions']}
                empty="No retention entries."
                rows={retentions.map((r) => [
                  formatMoney(r.withheld_amount),
                  formatMoney(r.released_amount),
                  <Button
                    key={String(r.id)}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      run('Retention released', () =>
                        releaseRetention({
                          projectId,
                          retentionId: String(r.id),
                          body: { released_by: 'web' },
                        }).unwrap(),
                      )
                    }
                  >
                    Release
                  </Button>,
                ])}
              />
            </div>
            {!accountOptions.length ? (
              <ErrorText>
                Accounting accounts unavailable. Receipts and payments need a chart of accounts.
              </ErrorText>
            ) : null}
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'ledger' ? (
        <EntityDetailPanel title="Ledger">
          <div style={{ display: 'grid', gap: 16 }}>
            <SimpleTable
              headers={['Number', 'Type', 'Amount', 'Date', 'Open']}
              empty="No project vouchers."
              rows={vouchers.map((v) => [
                asCaption(v.voucher_number),
                asCaption(v.voucher_type),
                formatMoney(v.total_amount ?? v.amount),
                formatDateInput(v.voucher_date) || '—',
                <Link
                  key={String(v.id)}
                  to={`/finance/vouchers/${String(v.id)}`}
                  title={String(v.voucher_number || v.id)}
                >
                  Open
                </Link>,
              ])}
            />
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <strong>Revenue recognition</strong>
              <Button
                type="button"
                onClick={() =>
                  run('Recognition drafted', () =>
                    draftRecognition({
                      projectId,
                      body: {
                        period_end: new Date().toISOString().slice(0, 10),
                        method: 'Percent Complete',
                        percent_complete: Number(
                          (summary as Record<string, unknown> | undefined)?.progress ??
                            workspace?.progress,
                        ) || 0,
                      },
                    }).unwrap(),
                  )
                }
              >
                Draft recognition
              </Button>
            </div>
            <SimpleTable
              headers={['Period', 'Status', 'Current', 'Actions']}
              empty="No recognition entries."
              rows={recognition.map((r) => {
                const status = String(r.status || '');
                return [
                  formatDateInput(r.period_end) || '—',
                  asCaption(r.status),
                  formatMoney(r.current_recognised),
                  <span key={String(r.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {status === 'Draft' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          run('Recognition approved', () =>
                            approveRecognition({
                              projectId,
                              entryId: String(r.id),
                            }).unwrap(),
                          )
                        }
                      >
                        Approve
                      </Button>
                    ) : null}
                    {status === 'Approved' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          run('Recognition posted', () =>
                            postRecognition({
                              projectId,
                              entryId: String(r.id),
                            }).unwrap(),
                          )
                        }
                      >
                        Post
                      </Button>
                    ) : null}
                    {status !== 'Draft' && status !== 'Approved' ? (
                      <span className="el-muted">—</span>
                    ) : null}
                  </span>,
                ];
              })}
            />
            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <strong>Reconciliations</strong>
              <Button
                type="button"
                onClick={() =>
                  run('Reconciliation created', () =>
                    createReconciliation({
                      projectId,
                      body: {
                        as_of: new Date().toISOString().slice(0, 10),
                        notes: 'Project books check',
                      },
                    }).unwrap(),
                  )
                }
              >
                Create reconciliation
              </Button>
            </div>
            <SimpleTable
              headers={['As of', 'Status', 'Notes']}
              empty="No reconciliations."
              rows={reconciliations.map((r) => [
                formatDateInput(r.as_of) || '—',
                asCaption(r.status),
                asCaption(r.notes),
              ])}
            />
          </div>
        </EntityDetailPanel>
      ) : null}

      {tab === 'profit' ? (
        <EntityDetailPanel title="Profit">
          <EntityDetailSnapshot
            ariaLabel="Profitability"
            items={[
              { label: 'Labour cost', value: formatMoney(profitability?.labour_cost) },
              { label: 'Other cost', value: formatMoney(profitability?.other_cost) },
              { label: 'Total cost', value: formatMoney(profitability?.total_cost) },
              { label: 'Planned revenue', value: formatMoney(profitability?.planned_revenue) },
              { label: 'Billed revenue', value: formatMoney(profitability?.billed_revenue) },
              { label: 'Budget margin', value: formatMoney(profitability?.budget_margin) },
              { label: 'Billed margin', value: formatMoney(profitability?.billed_margin) },
            ]}
          />
          <SimpleTable
            headers={['Activity', 'Cost', 'Planned rev', 'Billed']}
            empty="No activity profitability rows."
            rows={(
              (Array.isArray(profitability?.activity_rows)
                ? profitability!.activity_rows
                : []) as Record<string, unknown>[]
            ).map((row) => [
              asCaption(row.activity_name),
              formatMoney(row.total_cost),
              formatMoney(row.planned_revenue),
              formatMoney(row.billed_revenue),
            ])}
          />
        </EntityDetailPanel>
      ) : null}

      {tab === 'history' ? (
        <EntityDetailPanel title="History">
          <SimpleTable
            headers={['When', 'Entity', 'Action', 'Actor', 'Entity id']}
            empty="No history yet."
            rows={history.map((entry) => [
              asCaption(entry.created_at),
              asCaption(entry.entity_type),
              asCaption(entry.action),
              asCaption(entry.actor_name) !== '—'
                ? asCaption(entry.actor_name)
                : asCaption(entry.actor_id),
              asCaption(entry.entity_id),
            ])}
          />
        </EntityDetailPanel>
      ) : null}

      {tab === 'settings' ? (
        <EntityDetailPanel title="Settings">
          <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
            <FormRow label="Retention %">
              <input value={retentionPct} onChange={(e) => setRetentionPct(e.target.value)} />
            </FormRow>
            <Button
              type="button"
              onClick={() =>
                run('Settings saved', () =>
                  updateProject({
                    id: projectId,
                    body: {
                      retention_pct:
                        retentionPct === '' ? undefined : Number(retentionPct) || 0,
                    },
                  }).unwrap(),
                )
              }
            >
              Save settings
            </Button>
            <p style={{ margin: 0, color: '#667' }}>
              Portal and site-mobile remain on dedicated pages:{' '}
              <Link to={`/projects/portal/${projectId}`}>Portal</Link> ·{' '}
              <Link to={`/projects/site-mobile/${projectId}`}>Site mobile</Link>
            </p>
          </div>
        </EntityDetailPanel>
      ) : null}
    </>
  );
}

import {
  useHomeDashboardQuery,
  useListCustomersQuery,
  useListSalesInvoicesQuery,
  useCreateSalesInvoiceMutation,
  useListPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useListPurchaseBillsQuery,
  useCreatePurchaseBillMutation,
  useInventoryHealthQuery,
  useCreateStockReserveMutation,
  useFinanceHealthQuery,
  useCreateFinancePostingMutation,
  useListBoutiqueOrdersQuery,
  useCreateBoutiqueOrderMutation,
  useListBoutiqueItemsQuery,
  useCreateBoutiqueItemMutation,
  useListStoreActivitiesQuery,
  useCreateStoreActivityMutation,
  useListStoreTimeEntriesQuery,
  useCreateStoreTimeEntryMutation,
  useListCrmLeadsQuery,
  useCreateCrmLeadMutation,
  useListCrmEnquiriesQuery,
  useCreateCrmEnquiryMutation,
  useListCrmActivitiesQuery,
  useCreateCrmActivityMutation,
  useListSchedulerJobsQuery,
  useCreateSchedulerJobMutation,
  useRunSchedulerJobMutation,
  useListProjectsQuery,
  useCreateProjectMutation,
  useListProjectEnquiriesQuery,
  useCreateProjectEnquiryMutation,
  useListRecipesQuery,
  useCreateRecipeMutation,
  useListBatchesQuery,
  useCreateBatchMutation,
  useCompleteBatchMutation,
  useListMigrationBatchesQuery,
  useCreateMigrationBatchMutation,
  useRunMigrationBatchMutation,
  useSystemDiagnosticsQuery,
  useUpsertSystemSettingMutation,
  useListAccessUsersQuery,
  useCreateAccessUserMutation,
  useListAccessRolesQuery,
  useReportsCatalogQuery,
  useGetPrefsQuery,
  usePutPrefsMutation,
} from '@vaybooks/store';
import { StatusBanner } from '@vaybooks/ui-kit';
import { CreateForm, ResourcePage } from '../components/ResourcePage';

export function HomePage() {
  const { data, isLoading, error, refetch } = useHomeDashboardQuery();
  const metrics = (data?.metrics as Record<string, unknown>) || {};
  return (
    <ResourcePage
      title="Home"
      columns={[
        { key: 'metric', header: 'Metric' },
        { key: 'value', header: 'Value' },
      ]}
      rows={Object.entries(metrics).map(([metric, value]) => ({ id: metric, metric, value }))}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
    />
  );
}

export function SalesPage() {
  const customersQ = useListCustomersQuery();
  const { data = [], isLoading, error, refetch } = useListSalesInvoicesQuery();
  const [createInvoice] = useCreateSalesInvoiceMutation();
  const customers = customersQ.data || [];
  return (
    <ResourcePage
      title="Sales invoices"
      columns={[
        { key: 'id', header: 'Id' },
        { key: 'customer_id', header: 'Customer' },
        { key: 'total', header: 'Total' },
        { key: 'stock_status', header: 'Stock' },
        { key: 'posting_status', header: 'Posting' },
        { key: 'degraded_pending', header: 'Degraded' },
      ]}
      rows={data}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <>
          {customers.length === 0 && (
            <StatusBanner>Create a customer under Parties first (UI supplies customer_id).</StatusBanner>
          )}
          <CreateForm
            fields={[
              { name: 'customer_id', label: 'Customer id', placeholder: customers[0]?.id as string },
              { name: 'total', label: 'Total', type: 'number' },
            ]}
            onSubmit={async (v) => {
              await createInvoice({ customer_id: v.customer_id, total: Number(v.total) || 0 });
            }}
          />
        </>
      }
    />
  );
}

export function PurchasesPage() {
  const { data: orders = [], isLoading, error, refetch } = useListPurchaseOrdersQuery();
  const bills = useListPurchaseBillsQuery();
  const [createPo] = useCreatePurchaseOrderMutation();
  const [createBill] = useCreatePurchaseBillMutation();
  return (
    <div>
      <ResourcePage
        title="Purchase orders"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'vendor_id', header: 'Vendor' },
          { key: 'total', header: 'Total' },
        ]}
        rows={orders}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
        form={
          <CreateForm
            fields={[
              { name: 'vendor_id', label: 'Vendor id' },
              { name: 'total', label: 'Total', type: 'number' },
            ]}
            onSubmit={async (v) => {
              await createPo({ vendor_id: v.vendor_id, total: Number(v.total) || 0 });
            }}
          />
        }
      />
      <ResourcePage
        title="Purchase bills"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'vendor_id', header: 'Vendor' },
          { key: 'total', header: 'Total' },
          { key: 'degraded_pending', header: 'Degraded' },
        ]}
        rows={bills.data || []}
        isLoading={bills.isLoading}
        error={bills.error}
        onRefresh={bills.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'vendor_id', label: 'Vendor id' },
              { name: 'total', label: 'Total', type: 'number' },
            ]}
            onSubmit={async (v) => {
              await createBill({ vendor_id: v.vendor_id, total: Number(v.total) || 0 });
            }}
          />
        }
      />
    </div>
  );
}

export function InventoryPage() {
  const { data, isLoading, error, refetch } = useInventoryHealthQuery();
  const [reserve] = useCreateStockReserveMutation();
  return (
    <ResourcePage
      title="Inventory"
      columns={[
        { key: 'module', header: 'Module' },
        { key: 'status', header: 'Status' },
        { key: 'consumer_healthy', header: 'Consumer' },
      ]}
      rows={data ? [{ ...data, id: 'inv' }] : []}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <CreateForm
          fields={[
            { name: 'key', label: 'Reserve key' },
            { name: 'qty', label: 'Qty', type: 'number' },
          ]}
          submitLabel="Request reserve"
          onSubmit={async (v) => {
            await reserve({ key: v.key, qty: Number(v.qty) || 1 });
            refetch();
          }}
        />
      }
    />
  );
}

export function FinancePage() {
  const { data, isLoading, error, refetch } = useFinanceHealthQuery();
  const [post] = useCreateFinancePostingMutation();
  return (
    <ResourcePage
      title="Finance"
      columns={[
        { key: 'module', header: 'Module' },
        { key: 'status', header: 'Status' },
        { key: 'consumer_healthy', header: 'Consumer' },
      ]}
      rows={data ? [{ ...data, id: 'fin' }] : []}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <CreateForm
          fields={[
            { name: 'key', label: 'Posting key' },
            { name: 'amount', label: 'Amount', type: 'number' },
          ]}
          submitLabel="Request posting"
          onSubmit={async (v) => {
            await post({ key: v.key, amount: Number(v.amount) || 0 });
            refetch();
          }}
        />
      }
    />
  );
}

export function BoutiquePage() {
  const orders = useListBoutiqueOrdersQuery();
  const items = useListBoutiqueItemsQuery();
  const [createOrder] = useCreateBoutiqueOrderMutation();
  const [createItem] = useCreateBoutiqueItemMutation();
  return (
    <div>
      <ResourcePage
        title="Boutique orders"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'customer_id', header: 'Customer' },
          { key: 'status', header: 'Status' },
        ]}
        rows={orders.data || []}
        isLoading={orders.isLoading}
        error={orders.error}
        onRefresh={orders.refetch}
        form={
          <CreateForm
            fields={[{ name: 'customer_id', label: 'Customer id' }]}
            onSubmit={async (v) => {
              await createOrder({ customer_id: v.customer_id });
            }}
          />
        }
      />
      <ResourcePage
        title="Boutique items"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'order_id', header: 'Order' },
          { key: 'name', header: 'Name' },
          { key: 'quantity', header: 'Qty' },
        ]}
        rows={items.data || []}
        isLoading={items.isLoading}
        error={items.error}
        onRefresh={items.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'order_id', label: 'Order id' },
              { name: 'name', label: 'Item name' },
            ]}
            onSubmit={async (v) => {
              await createItem({ order_id: v.order_id, name: v.name });
            }}
          />
        }
      />
    </div>
  );
}

export function StorePage() {
  const acts = useListStoreActivitiesQuery();
  const entries = useListStoreTimeEntriesQuery();
  const [createAct] = useCreateStoreActivityMutation();
  const [createEntry] = useCreateStoreTimeEntryMutation();
  return (
    <div>
      <ResourcePage
        title="Store activities"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'name', header: 'Name' },
        ]}
        rows={acts.data || []}
        isLoading={acts.isLoading}
        error={acts.error}
        onRefresh={acts.refetch}
        form={
          <CreateForm
            fields={[{ name: 'name', label: 'Activity name' }]}
            onSubmit={async (v) => {
              await createAct({ name: v.name });
            }}
          />
        }
      />
      <ResourcePage
        title="Time entries"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'worker_id', header: 'Worker' },
          { key: 'activity_id', header: 'Activity' },
          { key: 'hours', header: 'Hours' },
        ]}
        rows={entries.data || []}
        isLoading={entries.isLoading}
        error={entries.error}
        onRefresh={entries.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'worker_id', label: 'Worker id' },
              { name: 'activity_id', label: 'Activity id' },
              { name: 'hours', label: 'Hours', type: 'number' },
            ]}
            onSubmit={async (v) => {
              await createEntry({
                worker_id: v.worker_id,
                activity_id: v.activity_id,
                hours: Number(v.hours) || 1,
              });
            }}
          />
        }
      />
    </div>
  );
}

export function CrmPage() {
  const leads = useListCrmLeadsQuery();
  const enquiries = useListCrmEnquiriesQuery();
  const activities = useListCrmActivitiesQuery();
  const [createLead] = useCreateCrmLeadMutation();
  const [createEnquiry] = useCreateCrmEnquiryMutation();
  const [createActivity] = useCreateCrmActivityMutation();
  return (
    <div>
      <ResourcePage
        title="CRM leads"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'name', header: 'Name' },
          { key: 'status', header: 'Status' },
        ]}
        rows={leads.data || []}
        isLoading={leads.isLoading}
        error={leads.error}
        onRefresh={leads.refetch}
        form={
          <CreateForm
            fields={[{ name: 'name', label: 'Lead name' }]}
            onSubmit={async (v) => {
              await createLead({ name: v.name });
            }}
          />
        }
      />
      <ResourcePage
        title="CRM enquiries"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'subject', header: 'Subject' },
          { key: 'lead_id', header: 'Lead' },
        ]}
        rows={enquiries.data || []}
        isLoading={enquiries.isLoading}
        error={enquiries.error}
        onRefresh={enquiries.refetch}
        form={
          <CreateForm
fields={[
              { name: 'subject', label: 'Subject' },
              { name: 'lead_id', label: 'Lead id (optional)', required: false },
            ]}
            onSubmit={async (v) => {
              await createEnquiry({ subject: v.subject, lead_id: v.lead_id || undefined });
            }}
          />
        }
      />
      <ResourcePage
        title="CRM activities"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'kind', header: 'Kind' },
          { key: 'lead_id', header: 'Lead' },
          { key: 'notes', header: 'Notes' },
        ]}
        rows={activities.data || []}
        isLoading={activities.isLoading}
        error={activities.error}
        onRefresh={activities.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'kind', label: 'Kind', placeholder: 'call', required: false },
              { name: 'lead_id', label: 'Lead id', required: false },
              { name: 'notes', label: 'Notes', required: false },
            ]}
            onSubmit={async (v) => {
              await createActivity({ kind: v.kind || 'call', lead_id: v.lead_id || undefined, notes: v.notes });
            }}
          />
        }
      />
    </div>
  );
}

export function ProjectsPage() {
  const projects = useListProjectsQuery();
  const enquiries = useListProjectEnquiriesQuery();
  const [createProject] = useCreateProjectMutation();
  const [createEnquiry] = useCreateProjectEnquiryMutation();
  return (
    <div>
      <ResourcePage
        title="Projects"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'name', header: 'Name' },
          { key: 'customer_id', header: 'Customer' },
          { key: 'status', header: 'Status' },
        ]}
        rows={projects.data || []}
        isLoading={projects.isLoading}
        error={projects.error}
        onRefresh={projects.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'customer_id', label: 'Customer id' },
            ]}
            onSubmit={async (v) => {
              await createProject({ name: v.name, customer_id: v.customer_id });
            }}
          />
        }
      />
      <ResourcePage
        title="Project enquiries"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'subject', header: 'Subject' },
          { key: 'project_id', header: 'Project' },
        ]}
        rows={enquiries.data || []}
        isLoading={enquiries.isLoading}
        error={enquiries.error}
        onRefresh={enquiries.refetch}
        form={
          <CreateForm
fields={[
              { name: 'subject', label: 'Subject' },
              { name: 'project_id', label: 'Project id', required: false },
            ]}
            onSubmit={async (v) => {
              await createEnquiry({ subject: v.subject, project_id: v.project_id || undefined });
            }}
          />
        }
      />
    </div>
  );
}

export function ProductionPage() {
  const recipes = useListRecipesQuery();
  const batches = useListBatchesQuery();
  const [createRecipe] = useCreateRecipeMutation();
  const [createBatch] = useCreateBatchMutation();
  const [completeBatch] = useCompleteBatchMutation();
  return (
    <div>
      <ResourcePage
        title="Recipes"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'name', header: 'Name' },
          { key: 'output_product_id', header: 'Output product' },
        ]}
        rows={recipes.data || []}
        isLoading={recipes.isLoading}
        error={recipes.error}
        onRefresh={recipes.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'output_product_id', label: 'Output product id' },
            ]}
            onSubmit={async (v) => {
              await createRecipe({ name: v.name, output_product_id: v.output_product_id });
            }}
          />
        }
      />
      <ResourcePage
        title="Batches"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'recipe_id', header: 'Recipe' },
          { key: 'planned_qty', header: 'Qty' },
          { key: 'status', header: 'Status' },
        ]}
        rows={batches.data || []}
        isLoading={batches.isLoading}
        error={batches.error}
        onRefresh={batches.refetch}
        form={
          <>
            <CreateForm
              fields={[
                { name: 'recipe_id', label: 'Recipe id' },
                { name: 'planned_qty', label: 'Planned qty', type: 'number' },
              ]}
              onSubmit={async (v) => {
                await createBatch({ recipe_id: v.recipe_id, planned_qty: Number(v.planned_qty) || 1 });
              }}
            />
            <CreateForm
              fields={[{ name: 'batch_id', label: 'Complete batch id' }]}
              submitLabel="Complete batch"
              onSubmit={async (v) => {
                await completeBatch(v.batch_id);
                batches.refetch();
              }}
            />
          </>
        }
      />
    </div>
  );
}

export function SchedulersPage() {
  const { data = [], isLoading, error, refetch } = useListSchedulerJobsQuery();
  const [createJob] = useCreateSchedulerJobMutation();
  const [runJob] = useRunSchedulerJobMutation();
  return (
    <ResourcePage
      title="Schedulers"
      columns={[
        { key: 'id', header: 'Id' },
        { key: 'name', header: 'Name' },
        { key: 'module', header: 'Module' },
        { key: 'status', header: 'Status' },
        { key: 'cron', header: 'Cron' },
      ]}
      rows={data}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <>
          <CreateForm
            fields={[
              { name: 'name', label: 'Job name' },
              { name: 'module', label: 'Module', placeholder: 'crm' },
            ]}
            onSubmit={async (v) => {
              await createJob({ name: v.name, module: v.module || 'crm' });
            }}
          />
          <CreateForm
            fields={[{ name: 'job_id', label: 'Run job id' }]}
            submitLabel="Run job"
            onSubmit={async (v) => {
              await runJob(v.job_id);
              refetch();
            }}
          />
        </>
      }
    />
  );
}

export function ReportsPage() {
  const { data, isLoading, error, refetch } = useReportsCatalogQuery();
  const rows = (data?.reports || []).map((r) => ({ ...r }));
  return (
    <ResourcePage
      title="Reports"
      columns={[
        { key: 'id', header: 'Id' },
        { key: 'title', header: 'Title' },
      ]}
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
    />
  );
}

export function MigrationPage() {
  const { data = [], isLoading, error, refetch } = useListMigrationBatchesQuery();
  const [createBatch] = useCreateMigrationBatchMutation();
  const [runBatch] = useRunMigrationBatchMutation();
  return (
    <ResourcePage
      title="Migration"
      columns={[
        { key: 'id', header: 'Id' },
        { key: 'source', header: 'Source' },
        { key: 'entity', header: 'Entity' },
        { key: 'status', header: 'Status' },
        { key: 'progress', header: 'Progress' },
      ]}
      rows={data}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <>
          <CreateForm
            fields={[
              { name: 'source', label: 'Source', placeholder: 'csv' },
              { name: 'entity', label: 'Entity', placeholder: 'customers' },
            ]}
            onSubmit={async (v) => {
              await createBatch({ source: v.source || 'csv', entity: v.entity });
            }}
          />
          <CreateForm
            fields={[{ name: 'batch_id', label: 'Run batch id' }]}
            submitLabel="Run batch"
            onSubmit={async (v) => {
              await runBatch(v.batch_id);
              refetch();
            }}
          />
        </>
      }
    />
  );
}

export function AccessPage() {
  const users = useListAccessUsersQuery();
  const roles = useListAccessRolesQuery();
  const [createUser] = useCreateAccessUserMutation();
  return (
    <div>
      <ResourcePage
        title="Access users"
        columns={[
          { key: 'username', header: 'Username' },
          { key: 'display_name', header: 'Display name' },
          { key: 'role_ids', header: 'Roles' },
        ]}
        rows={(users.data || []).map((u) => ({
          ...u,
          role_ids: Array.isArray(u.role_ids) ? (u.role_ids as string[]).join(', ') : u.role_ids,
        }))}
        isLoading={users.isLoading}
        error={users.error}
        onRefresh={users.refetch}
        form={
          <CreateForm
            fields={[
              { name: 'username', label: 'Username' },
              { name: 'display_name', label: 'Display name' },
            ]}
            onSubmit={async (v) => {
              await createUser({
                username: v.username,
                display_name: v.display_name,
                password: 'changeme',
                role_ids: [],
              });
            }}
          />
        }
      />
      <ResourcePage
        title="Roles"
        columns={[
          { key: 'id', header: 'Id' },
          { key: 'name', header: 'Name' },
        ]}
        rows={roles.data || []}
        isLoading={roles.isLoading}
        error={roles.error}
        onRefresh={roles.refetch}
      />
    </div>
  );
}

export function SettingsPage() {
  const { data, isLoading, error, refetch } = useGetPrefsQuery();
  const [putPrefs] = usePutPrefsMutation();
  return (
    <ResourcePage
      title="Settings"
      columns={[
        { key: 'timezone', header: 'Timezone' },
        { key: 'locale', header: 'Locale' },
      ]}
      rows={data ? [{ ...data, id: 'prefs' }] : []}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <CreateForm
          fields={[
            { name: 'timezone', label: 'Timezone', placeholder: 'UTC', required: false },
            { name: 'locale', label: 'Locale', placeholder: 'en', required: false },
          ]}
          submitLabel="Save prefs"
          onSubmit={async (v) => {
            await putPrefs({ timezone: v.timezone || undefined, locale: v.locale || undefined });
          }}
        />
      }
    />
  );
}

export function SystemPage() {
  const { data, isLoading, error, refetch } = useSystemDiagnosticsQuery();
  const [upsert] = useUpsertSystemSettingMutation();
  return (
    <ResourcePage
      title="System"
      columns={[
        { key: 'status', header: 'Status' },
        { key: 'process', header: 'Process' },
        { key: 'server_time_utc', header: 'Server UTC' },
        { key: 'settings_count', header: 'Settings' },
      ]}
      rows={data ? [{ ...data, id: 'diag' }] : []}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      form={
        <CreateForm
          fields={[
            { name: 'key', label: 'Setting key' },
            { name: 'value', label: 'Value' },
          ]}
          submitLabel="Save setting"
          onSubmit={async (v) => {
            await upsert({ key: v.key, value: v.value });
            refetch();
          }}
        />
      }
    />
  );
}

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInventoryOverviewQuery } from '@vaybooks/store';
import { Button, EntityCard, EntityCardGrid, ErrorText } from '@vaybooks/ui-kit';

function formatMoney(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #d9e3de',
        borderRadius: 10,
        background: '#fff',
        padding: '1rem 1.1rem',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, color: '#667' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--vb-color-primary, #185c4c)' }}>{value}</div>
    </div>
  );
}

const QUICK_LINKS: { to: string; label: string }[] = [
  { to: '/inventory/categories', label: 'Categories' },
  { to: '/inventory/products', label: 'Products' },
  { to: '/inventory/stock', label: 'Stock' },
  { to: '/inventory/movements', label: 'Movements' },
  { to: '/inventory/transfers', label: 'Transfers' },
  { to: '/inventory/reports', label: 'Reports' },
];

/** Streamlit parity: inventory landing page — KPIs, low-stock spotlight, quick nav. */
export function InventoryOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useInventoryOverviewQuery();

  const kpis = useMemo(
    () => (data && typeof data.kpis === 'object' && data.kpis ? (data.kpis as Record<string, unknown>) : {}),
    [data],
  );
  const lowStock = useMemo(
    () => (data && Array.isArray(data.low_stock) ? (data.low_stock as Record<string, unknown>[]) : []),
    [data],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--vb-color-primary, #185c4c)' }}>Inventory Overview</h2>
        <Button type="button" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load inventory overview. Is the API running?</ErrorText> : null}

      {!isLoading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 28,
            }}
          >
            <Kpi label="Products" value={String(Number(kpis.product_count ?? 0))} />
            <Kpi label="Low stock" value={String(Number(kpis.low_stock_count ?? 0))} />
            <Kpi label="Out of stock" value={String(Number(kpis.out_of_stock_count ?? 0))} />
            <Kpi label="Stock value" value={formatMoney(Number(kpis.stock_value ?? 0))} />
          </div>

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', marginBottom: 8 }}>Low stock products</h3>
          {lowStock.length === 0 ? (
            <p style={{ color: '#667' }}>Nothing is running low right now.</p>
          ) : (
            <EntityCardGrid>
              {lowStock.map((row) => (
                <EntityCard
                  key={String(row.id)}
                  title={String(row.name || row.sku || 'Unnamed product')}
                  captions={[
                    row.sku ? `SKU: ${String(row.sku)}` : '',
                    `Qty on hand: ${Number(row.current_qty ?? 0)}`,
                  ].filter(Boolean)}
                  badges={[{ label: String(row.stock_status || 'Low'), tone: 'red' }]}
                  onView={() => navigate(`/inventory/products/${String(row.id)}`)}
                />
              ))}
            </EntityCardGrid>
          )}

          <h3 style={{ color: 'var(--vb-color-primary, #185c4c)', margin: '28px 0 10px' }}>Quick links</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: 8,
                  border: '1px solid #c5d4ce',
                  background: '#eef6f2',
                  color: '#185c4c',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

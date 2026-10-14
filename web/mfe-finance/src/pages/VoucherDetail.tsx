import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetFinanceVoucherQuery } from '@vaybooks/store';
import {
  Button,
  EntityDetailBack,
  EntityDetailHero,
  EntityDetailPage,
  EntityDetailPanel,
  EntityDetailSnapshot,
  EntityDetailStickyActions,
  EntityListLoading,
  ErrorText,
  useDetailKeyboardBack,
} from '@vaybooks/ui-kit';
import { asCaption, formatMoney } from '../utils';

export function VoucherDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  useDetailKeyboardBack('/finance/vouchers');
  const { data, isLoading, error } = useGetFinanceVoucherQuery(id, { skip: !id });

  const lines = useMemo(() => {
    if (!data || !Array.isArray(data.lines)) return [] as Record<string, unknown>[];
    return data.lines as Record<string, unknown>[];
  }, [data]);

  if (isLoading) {
    return (
      <EntityDetailPage>
        <EntityListLoading>Loading voucher…</EntityListLoading>
      </EntityDetailPage>
    );
  }

  if (error || !data) {
    return (
      <EntityDetailPage>
        <EntityDetailBack to="/finance/vouchers" label="Vouchers" />
        <ErrorText>Voucher not found.</ErrorText>
      </EntityDetailPage>
    );
  }

  const amount = formatMoney(Number(data.amount ?? data.total_amount ?? 0));

  return (
    <EntityDetailPage>
      <EntityDetailBack to="/finance/vouchers" label="Vouchers" />

      <EntityDetailHero
        kicker="Finance · Voucher"
        title={asCaption(data.voucher_number) || 'Voucher'}
        lead={
          <>
            <span>{asCaption(data.voucher_type)}</span>
            <span className="ed-lead-sep"> · {amount}</span>
            {data.party_name ? (
              <span className="ed-lead-sep"> · {asCaption(data.party_name)}</span>
            ) : null}
          </>
        }
      />

      <EntityDetailSnapshot
        ariaLabel="Voucher facts"
        items={[
          { label: 'Type', value: asCaption(data.voucher_type) || '—' },
          { label: 'Amount', value: amount },
          {
            label: 'Date',
            value: String(data.voucher_date || '').slice(0, 10) || '—',
          },
          { label: 'Party', value: asCaption(data.party_name) || '—' },
        ]}
      />

      <EntityDetailPanel title="Details">
        <p style={{ margin: '0 0 12px' }}>{asCaption(data.description) || 'No description'}</p>
        {data.reference_project_id ? (
          <p style={{ margin: 0 }}>
            Project ref: {asCaption(data.reference_project_id)}
          </p>
        ) : null}
      </EntityDetailPanel>

      <EntityDetailPanel title={`Lines (${lines.length})`}>
        {lines.length === 0 ? (
          <p style={{ margin: 0, color: '#667' }}>No line items.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Account', 'Description', 'Debit', 'Credit'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={String(line.id || i)}>
                    <td style={{ padding: '8px 10px' }}>
                      {asCaption(line.account_name || line.account_id)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{asCaption(line.description)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {formatMoney(Number(line.debit_amount || 0))}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {formatMoney(Number(line.credit_amount || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EntityDetailPanel>

      <EntityDetailStickyActions
        start={
          <Button type="button" variant="ghost" onClick={() => navigate('/finance/vouchers')}>
            Back to vouchers
          </Button>
        }
      />
    </EntityDetailPage>
  );
}

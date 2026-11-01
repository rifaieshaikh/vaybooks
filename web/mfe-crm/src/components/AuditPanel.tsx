import { useGetCrmEntityAuditQuery } from '@vaybooks/store';
import { EntityListLoading, ErrorText } from '@vaybooks/ui-kit';
import { asCaption, humanizeKey } from '../utils';
import { SectionForm } from './SectionForm';

type Props = {
  entityType: 'lead' | 'enquiry' | 'activity';
  entityId: string;
  enabled?: boolean;
};

function formatWhen(value: unknown): string {
  if (value == null || value === '') return '—';
  const raw = String(value);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return asCaption(raw);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatScalar(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function fieldSummary(item: Record<string, unknown>): string {
  const reason = String(item.reason || '').trim();
  const before =
    item.before && typeof item.before === 'object' && !Array.isArray(item.before)
      ? (item.before as Record<string, unknown>)
      : null;
  const after =
    item.after && typeof item.after === 'object' && !Array.isArray(item.after)
      ? (item.after as Record<string, unknown>)
      : null;

  const changes: string[] = [];
  if (before || after) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of keys) {
      if (key === 'updated_at' || key === 'created_at') continue;
      const left = before?.[key];
      const right = after?.[key];
      if (JSON.stringify(left) === JSON.stringify(right)) continue;
      if (before && after) {
        changes.push(`${humanizeKey(key)}: ${formatScalar(left)} → ${formatScalar(right)}`);
      } else if (after && right != null && right !== '') {
        changes.push(`${humanizeKey(key)}: ${formatScalar(right)}`);
      } else if (before && left != null && left !== '') {
        changes.push(`${humanizeKey(key)}: was ${formatScalar(left)}`);
      }
      if (changes.length >= 6) break;
    }
  }

  const parts: string[] = [];
  if (reason) parts.push(reason);
  if (changes.length) parts.push(changes.join('; '));
  else if (item.details || item.message) parts.push(asCaption(item.details || item.message));
  return parts.join(' · ');
}

/** Audit trail for a CRM entity (gated by caller via `enabled`). */
export function AuditPanel({ entityType, entityId, enabled = true }: Props) {
  const { data, isLoading, error } = useGetCrmEntityAuditQuery(
    { entity_type: entityType, entity_id: entityId, limit: 50 },
    { skip: !enabled || !entityId },
  );

  if (!enabled) return null;

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <SectionForm title="Audit" description="Recent changes for this record.">
      {isLoading ? <EntityListLoading>Loading audit…</EntityListLoading> : null}
      {error ? <ErrorText>Failed to load audit.</ErrorText> : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className="el-muted" style={{ margin: 0 }}>
          No audit entries.
        </p>
      ) : null}
      {items.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
          {items.map((item, idx) => {
            const row = item as Record<string, unknown>;
            const summary = fieldSummary(row);
            return (
              <li key={String(row.id || `${idx}`)} style={{ display: 'grid', gap: 2 }}>
                <div>
                  <strong>{asCaption(row.action || row.event_type || 'change')}</strong>
                  {' · '}
                  {asCaption(row.actor_name || row.user_name || 'System')}
                  {' · '}
                  <span className="el-muted">{formatWhen(row.created_at || row.at)}</span>
                </div>
                {summary ? (
                  <div className="el-muted" style={{ fontSize: 13 }}>
                    {summary}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </SectionForm>
  );
}

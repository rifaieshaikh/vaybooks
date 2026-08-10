import { useGetCrmEntityAuditQuery } from '@vaybooks/store';
import { EntityListLoading, ErrorText } from '@vaybooks/ui-kit';
import { asCaption } from '../utils';
import { SectionForm } from './SectionForm';

type Props = {
  entityType: 'lead' | 'enquiry' | 'activity';
  entityId: string;
  enabled?: boolean;
};

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
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {items.map((item, idx) => (
            <li key={String(item.id || `${idx}`)}>
              <strong>{asCaption(item.action || item.event_type || item.field)}</strong>
              {' · '}
              {asCaption(item.actor_name || item.user_name)}
              {' · '}
              {asCaption(item.created_at || item.at)}
              {item.details || item.message ? (
                <span className="el-muted"> — {asCaption(item.details || item.message)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </SectionForm>
  );
}

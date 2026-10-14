import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useListNotificationsQuery, useMarkNotificationReadMutation } from '@vaybooks/store';

/** Strip scheduler bucket suffixes like `{id}:{week}` / `{id}:{date}`. */
function entityIdFromRef(refId: string): string {
  const idx = refId.indexOf(':');
  return idx > 0 ? refId.slice(0, idx) : refId;
}

/** Map scheduler/CRM notification ref_type → in-app route. */
export function notificationHref(row: Record<string, unknown>): string | null {
  const refType = String(row.ref_type || '')
    .trim()
    .toLowerCase();
  const rawId = String(row.ref_id || '').trim();
  if (!refType || !rawId) return null;
  const id = entityIdFromRef(rawId);
  if (!id) return null;

  if (refType === 'crm_lead' || refType === 'lead') return `/crm/leads/${id}`;
  if (refType === 'crm_enquiry' || refType === 'enquiry') return `/crm/enquiries/${id}`;
  if (
    refType === 'crm_activity' ||
    refType === 'activity' ||
    refType === 'crm_activity_promise'
  ) {
    return `/crm/activities/${id}`;
  }
  if (refType === 'customer') return `/parties/customers/${id}?tab=crm`;
  return null;
}

export function NotificationsMenu() {
  const { data = [], isLoading, error, refetch } = useListNotificationsQuery({ limit: 30 });
  const [markRead] = useMarkNotificationReadMutation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = data.length;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="vb-popover" ref={ref}>
      <button
        type="button"
        className="vb-icon-btn vb-notif-btn"
        title="Notifications"
        aria-label={count ? `Notifications (${count})` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          refetch();
        }}
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {count > 0 ? <span className="vb-notif-badge">{count > 99 ? '99+' : count}</span> : null}
      </button>
      {open && (
        <div
          className="vb-popover-menu vb-popover-menu-right"
          role="menu"
          style={{ minWidth: 320, maxHeight: 420, overflow: 'auto' }}
        >
          <div className="vb-popover-title">Notifications</div>
          {isLoading ? <div className="vb-popover-item">Loading…</div> : null}
          {error ? <div className="vb-popover-item">Failed to load.</div> : null}
          {!isLoading && !error && data.length === 0 ? (
            <div className="vb-popover-item">No open notifications.</div>
          ) : null}
          {data.map((row) => {
            const id = String(row.id || '');
            const source = String(row.source || 'scheduler');
            const title = String(row.title || row.kind || 'Notification');
            const body = String(row.body || row.message || '');
            const projectId = String(row.project_id || '');
            const href = notificationHref(row);
            return (
              <div
                key={id}
                className="vb-popover-item"
                style={{ display: 'grid', gap: 4, whiteSpace: 'normal' }}
              >
                <strong>{title}</strong>
                {body ? <span className="vb-muted">{body}</span> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {source === 'project' && projectId ? (
                    <Link to={`/projects/list/${projectId}`} onClick={() => setOpen(false)}>
                      Open project
                    </Link>
                  ) : null}
                  {href ? (
                    <Link to={href} onClick={() => setOpen(false)}>
                      Open
                    </Link>
                  ) : null}
                  {source === 'scheduler' ? (
                    <button
                      type="button"
                      className="vb-topbar-btn"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={async () => {
                        await markRead(id);
                        refetch();
                      }}
                    >
                      Dismiss
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

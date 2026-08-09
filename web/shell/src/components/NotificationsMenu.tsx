import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useListNotificationsQuery, useMarkNotificationReadMutation } from '@vaybooks/store';

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
        className="vb-icon-btn"
        title="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          refetch();
        }}
      >
        Bell{count ? ` (${count})` : ''}
      </button>
      {open && (
        <div className="vb-popover-menu vb-popover-menu-right" role="menu" style={{ minWidth: 320, maxHeight: 420, overflow: 'auto' }}>
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
            return (
              <div key={id} className="vb-popover-item" style={{ display: 'grid', gap: 4, whiteSpace: 'normal' }}>
                <strong>{title}</strong>
                {body ? <span className="vb-muted">{body}</span> : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  {source === 'project' && projectId ? (
                    <Link to={`/projects/list/${projectId}`} onClick={() => setOpen(false)}>
                      Open project
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

import { useEffect, useRef, useState } from 'react';
import {
  setWorkingLocationId,
  useAppDispatch,
  useGetWorkingLocationQuery,
  useSetWorkingLocationMutation,
} from '@vaybooks/store';

export function WorkingLocationMenu() {
  const dispatch = useAppDispatch();
  const { data, isLoading, error, refetch } = useGetWorkingLocationQuery();
  const [setLoc, setState] = useSetWorkingLocationMutation();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (data?.working_location_id) {
      dispatch(setWorkingLocationId(data.working_location_id));
    }
  }, [data?.working_location_id, dispatch]);

  const current = data?.working_location_id || '—';
  const label =
    current === 'ALL'
      ? 'All'
      : data?.accessible?.find((l) => l.id === current)?.code || current.slice(0, 6);

  async function choose(id: string) {
    setMsg('');
    try {
      const next = await setLoc({ working_location_id: id }).unwrap();
      dispatch(setWorkingLocationId(next.working_location_id));
      setOpen(false);
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'data' in e ? String((e as { data?: { detail?: string } }).data?.detail || 'Failed') : 'Failed');
    }
  }

  return (
    <div className="vb-popover" ref={ref}>
      <button
        type="button"
        className="vb-icon-btn"
        title="Working location"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          refetch();
        }}
      >
        {label || 'Loc'}
      </button>
      {open && (
        <div className="vb-popover-menu vb-popover-menu-right" role="menu" style={{ minWidth: 260 }}>
          <div className="vb-popover-title">Working location</div>
          {isLoading ? <div className="vb-popover-item">Loading…</div> : null}
          {error ? <div className="vb-popover-item">Failed to load locations.</div> : null}
          {!isLoading && !error && !(data?.accessible || []).length ? (
            <div className="vb-popover-item" style={{ whiteSpace: 'normal' }}>
              No locations assigned. Ask an admin to assign locations under Access → Users.
            </div>
          ) : null}
          {data?.allow_all ? (
            <button
              type="button"
              className="vb-popover-item"
              disabled={setState.isLoading}
              onClick={() => choose('ALL')}
            >
              {current === 'ALL' ? '✓ ' : ''}All my locations
            </button>
          ) : null}
          {(data?.accessible || []).map((loc) => (
            <button
              key={loc.id}
              type="button"
              className="vb-popover-item"
              disabled={setState.isLoading}
              onClick={() => choose(loc.id)}
            >
              {current === loc.id ? '✓ ' : ''}
              {loc.code} — {loc.name}
            </button>
          ))}
          {msg ? <div className="vb-popover-item" style={{ color: '#a33' }}>{msg}</div> : null}
        </div>
      )}
    </div>
  );
}

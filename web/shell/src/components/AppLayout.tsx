import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { clearSession, setLicenseStatus, useAppDispatch, useAppSelector, useLogoutMutation } from '@vaybooks/store';
import { SIDEBAR_GROUPS, TOPBAR_MENUS, type NavItem } from '../navConfig';
import './shellChrome.css';

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  display: 'block',
  padding: '0.4rem 0.65rem',
  borderRadius: 6,
  textDecoration: 'none',
  color: isActive ? 'var(--vb-color-on-primary, #fff)' : 'var(--vb-color-text, #1a1a1a)',
  background: isActive ? 'var(--vb-color-primary, #185c4c)' : 'transparent',
  fontSize: 13,
  fontWeight: isActive ? 600 : 400,
});

function MenuPopover({
  label,
  title,
  items,
  iconOnly,
}: {
  label: string;
  title: string;
  items: NavItem[];
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className={iconOnly ? 'vb-icon-btn' : 'vb-topbar-btn'}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div className="vb-popover-menu" role="menu">
          <div className="vb-popover-title">{title}</div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className="vb-popover-item"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu({ displayName }: { displayName: string | null }) {
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = displayName || 'Account';
  const initial = (name[0] || 'A').toUpperCase();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="vb-popover" ref={ref}>
      <button type="button" className="vb-account-chip" onClick={() => setOpen((v) => !v)}>
        <span className="vb-avatar">{initial}</span>
        <span className="vb-account-name">{name}</span>
      </button>
      {open && (
        <div className="vb-popover-menu vb-popover-menu-right" role="menu">
          <div className="vb-account-head">
            <span className="vb-avatar">{initial}</span>
            <span>
              <strong>{name}</strong>
              <br />
              <span className="vb-muted">Signed in</span>
            </span>
          </div>
          <div className="vb-popover-divider" />
          <button
            type="button"
            className="vb-popover-item vb-popover-danger"
            onClick={async () => {
              try {
                await logout().unwrap();
              } catch {
                /* ignore */
              }
              dispatch(clearSession());
              dispatch(setLicenseStatus('unknown'));
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const session = useAppSelector((s) => s.session);
  const license = useAppSelector((s) => s.license.status);
  const location = useLocation();
  const [rail, setRail] = useState(false);

  return (
    <div className={`vb-shell${rail ? ' vb-shell-rail' : ''}`}>
      <aside className="vb-sidebar">
        <div className="vb-sidebar-header">
          {!rail && <div className="vb-logo">VayBooks</div>}
          {rail && <div className="vb-logo-mark">V</div>}
          <button
            type="button"
            className="vb-rail-toggle"
            title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setRail((v) => !v)}
          >
            {rail ? '»' : '«'}
          </button>
        </div>
        <nav className="vb-sidebar-nav">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.header || 'home'} className="vb-nav-group">
              {group.header && !rail ? <div className="vb-nav-caption">{group.header}</div> : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={linkStyle}
                  title={item.label}
                  className={({ isActive }) => (isActive ? 'vb-nav-link active' : 'vb-nav-link')}
                >
                  {rail ? item.label.slice(0, 1) : item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {!rail && (
          <div className="vb-sidebar-footer">
            <div className="vb-sidebar-version">v0.0.1</div>
            <div className="vb-sidebar-license">License: {license}</div>
          </div>
        )}
      </aside>

      <div className="vb-main">
        <header className="vb-topbar">
          <div className="vb-topbar-search" aria-hidden="true">
            <span className="vb-search-icon">⌕</span>
            <input className="vb-search-input" type="text" placeholder="Search..." disabled />
          </div>
          <div className="vb-topbar-actions">
            <MenuPopover label="+ New" title={TOPBAR_MENUS.business.title} items={TOPBAR_MENUS.business.items} />
            <MenuPopover label="Export" title={TOPBAR_MENUS.migration.title} items={TOPBAR_MENUS.migration.items} />
            <div className="vb-topbar-divider" aria-hidden="true" />
            <button type="button" className="vb-icon-btn" title="Working location" disabled>
              Loc
            </button>
            <button type="button" className="vb-icon-btn" title="Notifications" disabled>
              Bell
            </button>
            <MenuPopover
              label="Sched"
              title={TOPBAR_MENUS.schedulers.title}
              items={TOPBAR_MENUS.schedulers.items}
              iconOnly
            />
            <MenuPopover label="Apps" title={TOPBAR_MENUS.access.title} items={TOPBAR_MENUS.access.items} iconOnly />
            <MenuPopover
              label="Settings"
              title={TOPBAR_MENUS.settings.title}
              items={TOPBAR_MENUS.settings.items}
              iconOnly
            />
            <AccountMenu displayName={session.displayName} />
          </div>
        </header>
        <main className="vb-content" key={location.pathname}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

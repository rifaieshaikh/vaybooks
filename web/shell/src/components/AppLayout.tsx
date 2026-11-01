import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import {
  clearSession,
  setEnabledModules,
  setLicenseStatus,
  setPermissions,
  useAppDispatch,
  useAppSelector,
  useCan,
  useModuleEnabled,
  useLogoutMutation,
  useMeQuery,
  baseApi,
} from '@vaybooks/store';
import { SIDEBAR_GROUPS, navItemVisible, type NavItem } from '../navConfig';
import { WorkingLocationMenu } from './WorkingLocationMenu';
import { NotificationsMenu } from './NotificationsMenu';
import { GlobalSearch } from './GlobalSearch';
import { CreateMenu, SettingsMenu } from './TopbarOverflow';
import { NavGlyph } from './navIcons';
import './shellChrome.css';

const RAIL_KEY = 'vb.shell.rail';

function readRailPref(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
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
      <button
        type="button"
        className="vb-account-chip"
        aria-label={`Account: ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vb-avatar">{initial}</span>
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
              dispatch(baseApi.util.resetApiState());
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
  const dispatch = useAppDispatch();
  const can = useCan();
  const moduleEnabled = useModuleEnabled();
  const [rail, setRail] = useState(readRailPref);
  const me = useMeQuery(undefined, { skip: !session.accessToken });
  const hasPermissionList = session.permissions.length > 0;

  useEffect(() => {
    const user = me.data?.user;
    if (!user) return;
    const perms = user.permissions;
    if (Array.isArray(perms)) {
      dispatch(setPermissions(perms.map(String)));
    }
    const mods = user.enabled_modules;
    if (Array.isArray(mods)) {
      dispatch(setEnabledModules(mods.map(String)));
    }
  }, [me.data, dispatch]);

  const filterItems = useCallback(
    (items: NavItem[]) =>
      items.filter((navItem) =>
        navItemVisible(navItem, { moduleEnabled, can, hasPermissionList }),
      ),
    [moduleEnabled, can, hasPermissionList],
  );

  const filteredGroups = SIDEBAR_GROUPS.map((group) => ({
    ...group,
    items: filterItems(group.items),
  })).filter((group) => group.items.length > 0);

  function toggleRail() {
    setRail((v) => {
      const next = !v;
      try {
        localStorage.setItem(RAIL_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className={`vb-shell${rail ? ' vb-shell-rail' : ''}`}>
      <header className="vb-topbar">
        <div className="vb-topbar-left">
          <button
            type="button"
            className="vb-icon-btn vb-rail-toggle"
            aria-pressed={rail}
            aria-label={rail ? 'Expand navigation' : 'Collapse navigation'}
            title={rail ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggleRail}
          >
            <PanelLeft size={18} strokeWidth={1.75} aria-hidden />
          </button>
          <Link to="/" className="vb-topbar-brand" title="VayBooks home">
            <img src="/logo.svg" alt="VayBooks" className="vb-topbar-logo" />
          </Link>
        </div>

        <div className="vb-topbar-center">
          <GlobalSearch filterItems={filterItems} />
        </div>

        <div className="vb-topbar-actions">
          <CreateMenu filterItems={filterItems} />
          <div className="vb-topbar-divider" aria-hidden="true" />
          <WorkingLocationMenu />
          <NotificationsMenu />
          <SettingsMenu filterItems={filterItems} />
          <AccountMenu displayName={session.displayName} />
        </div>
      </header>

      <div className="vb-shell-body">
        <aside className="vb-sidebar">
          <nav className="vb-sidebar-nav">
            {filteredGroups.map((group) => (
              <div key={group.header || 'home'} className="vb-nav-group">
                {group.header && !rail ? <div className="vb-nav-caption">{group.header}</div> : null}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    title={item.label}
                    className={({ isActive }) => (isActive ? 'vb-nav-link active' : 'vb-nav-link')}
                  >
                    <NavGlyph name={item.icon} size={rail ? 20 : 18} className="vb-nav-icon" />
                    {!rail ? <span className="vb-nav-label">{item.label}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          {!rail && (
            <div className="vb-sidebar-footer">
              <span className="vb-sidebar-meta">v0.0.1 · License: {license}</span>
            </div>
          )}
        </aside>

        <main className="vb-content" key={location.pathname}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

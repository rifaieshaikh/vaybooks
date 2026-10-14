import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  CREATE_ACTIONS,
  SETTINGS_SECTIONS,
  SIDEBAR_GROUPS,
  type NavItem,
} from '../navConfig';

const RECENT_KEY = 'vb.shell.search.recent';
const MAX_RECENTS = 8;

export type SearchEntry = {
  id: string;
  label: string;
  to: string;
  group: 'Pages' | 'Create' | 'Settings';
};

function loadRecents(): SearchEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry: SearchEntry) {
  const prev = loadRecents().filter((r) => r.id !== entry.id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_RECENTS)));
}

function buildIndex(filterItems: (items: NavItem[]) => NavItem[]): SearchEntry[] {
  const pages: SearchEntry[] = SIDEBAR_GROUPS.flatMap((g) =>
    filterItems(g.items).map((item) => ({
      id: `page:${item.to}`,
      label: item.label,
      to: item.to,
      group: 'Pages' as const,
    })),
  );
  const create: SearchEntry[] = filterItems(CREATE_ACTIONS).map((item) => ({
    id: `create:${item.to}`,
    label: item.label,
    to: item.to,
    group: 'Create' as const,
  }));
  const settings: SearchEntry[] = SETTINGS_SECTIONS.flatMap((section) =>
    filterItems(section.items).map((item) => ({
      id: `settings:${section.title}:${item.to}`,
      label: item.label,
      to: item.to,
      group: 'Settings' as const,
    })),
  );
  return [...pages, ...create, ...settings];
}

function matches(entry: SearchEntry, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.label.toLowerCase().includes(needle) ||
    entry.to.toLowerCase().includes(needle) ||
    entry.group.toLowerCase().includes(needle)
  );
}

const GROUP_ORDER: SearchEntry['group'][] = ['Pages', 'Create', 'Settings'];

export function GlobalSearch({ filterItems }: { filterItems: (items: NavItem[]) => NavItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<SearchEntry[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const flatListRef = useRef<SearchEntry[]>([]);
  const activeRef = useRef(0);

  const index = useMemo(() => buildIndex(filterItems), [filterItems]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return index.filter((e) => matches(e, q));
  }, [index, query]);

  const flatList = useMemo(() => {
    if (!query.trim()) {
      return recents.filter((r) => index.some((e) => e.id === r.id || e.to === r.to));
    }
    return results;
  }, [query, recents, results, index]);

  flatListRef.current = flatList;
  activeRef.current = active;

  const grouped = useMemo(() => {
    if (!query.trim()) {
      return flatList.length ? [{ title: 'Recent', items: flatList }] : [];
    }
    return GROUP_ORDER.map((title) => ({
      title,
      items: results.filter((r) => r.group === title),
    })).filter((g) => g.items.length > 0);
  }, [query, flatList, results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const openPalette = useCallback(() => {
    setRecents(loadRecents());
    setOpen(true);
    setQuery('');
    setActive(0);
  }, []);

  const go = useCallback(
    (entry: SearchEntry) => {
      saveRecent(entry);
      setRecents(loadRecents());
      setOpen(false);
      setQuery('');
      setActive(0);
      navigate(entry.to);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [navigate],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else openPalette();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close, openPalette]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      const list = flatListRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (list.length ? (i + 1) % list.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entry = list[activeRef.current];
        if (entry) go(entry);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'input, button.vb-palette-item',
        );
        if (!focusables?.length) return;
        const arr = Array.from(focusables);
        const idx = arr.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? arr[(idx - 1 + arr.length) % arr.length]
          : arr[(idx + 1) % arr.length];
        next?.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, go]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const chordHint =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K';

  const itemIndexById = useMemo(() => {
    const map = new Map<string, number>();
    flatList.forEach((e, i) => map.set(e.id, i));
    return map;
  }, [flatList]);

  return (
    <>
      <button
        type="button"
        className="vb-topbar-search-trigger"
        ref={triggerRef}
        onClick={openPalette}
        aria-label="Search navigation"
      >
        <Search size={16} strokeWidth={1.75} aria-hidden />
        <span className="vb-topbar-search-placeholder">Search pages, settings…</span>
        <kbd className="vb-topbar-search-kbd">{chordHint}</kbd>
      </button>

      {open ? (
        <div className="vb-palette-backdrop" role="presentation" onMouseDown={close}>
          <div
            className="vb-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            ref={dialogRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="vb-palette-input-row">
              <Search size={18} strokeWidth={1.75} aria-hidden />
              <input
                ref={inputRef}
                className="vb-palette-input"
                type="search"
                value={query}
                placeholder="Search pages, business, settings…"
                aria-label="Search"
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="vb-topbar-search-kbd">Esc</kbd>
            </div>
            <div className="vb-palette-results" role="listbox">
              {!query.trim() && !flatList.length ? (
                <div className="vb-palette-empty">Type to search navigation</div>
              ) : null}
              {query.trim() && !flatList.length ? (
                <div className="vb-palette-empty">No matches</div>
              ) : null}
              {grouped.map((group) => (
                <div key={group.title} className="vb-palette-group">
                  <div className="vb-palette-group-title">{group.title}</div>
                  {group.items.map((entry) => {
                    const idx = itemIndexById.get(entry.id) ?? 0;
                    const selected = idx === active;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`vb-palette-item${selected ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(entry)}
                      >
                        <span>{entry.label}</span>
                        <span className="vb-muted">{entry.to}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

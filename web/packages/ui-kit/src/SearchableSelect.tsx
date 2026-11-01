import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import './DocumentEditor.css';

export type SearchableSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When menu is closed, Enter advances (header/grid nav). */
  onKeyDownAdvance?: (e: KeyboardEvent<HTMLElement>) => void;
  /** Offer to create the typed name when no option matches it exactly. */
  onCreate?: (name: string) => void | Promise<void>;
};

type MenuPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  above: boolean;
};

/** Place the list in the viewport so a scrolling dialog cannot clip it. */
function menuPosition(anchor: HTMLElement): MenuPos {
  const rect = anchor.getBoundingClientRect();
  const gap = 2;
  const preferred = 220;
  const margin = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const above = spaceBelow < Math.min(preferred, 160) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(96, Math.min(preferred, above ? spaceAbove : spaceBelow));
  return {
    top: above ? rect.top - gap : rect.bottom + gap,
    left: rect.left,
    width: rect.width,
    maxHeight,
    above,
  };
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled,
  className,
  onKeyDownAdvance,
  onCreate,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const typedName = query.trim();
  const hasExactName = options.some((option) => option.label.trim().toLowerCase() === typedName.toLowerCase());
  const showCreate = Boolean(onCreate && typedName && !hasExactName);
  const menuItems = useMemo(() => {
    const rows: { kind: 'create' | 'option'; option?: SearchableSelectOption; name?: string }[] = [];
    if (showCreate) rows.push({ kind: 'create', name: typedName });
    for (const option of filtered) rows.push({ kind: 'option', option });
    return rows;
  }, [filtered, showCreate, typedName]);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? '');
      setActiveIndex(0);
    }
  }, [open, selected]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      if (inputRef.current) setMenuPos(menuPosition(inputRef.current));
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  async function createTyped() {
    if (!onCreate || !typedName || creating) return;
    setCreating(true);
    try {
      await onCreate(typedName);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className={['de-search', className].filter(Boolean).join(' ')}
      ref={rootRef}
    >
      <input
        ref={inputRef}
        className="de-search-input"
        type="text"
        value={open ? query : selected?.label ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === 'Enter' && onKeyDownAdvance) {
              onKeyDownAdvance(e);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(menuItems.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const item = menuItems[activeIndex];
            if (item?.kind === 'create') void createTyped();
            else if (item?.option) pick(item.option.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      <button
        type="button"
        className="de-search-toggle"
        aria-label="Show options"
        disabled={disabled}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          setQuery('');
          setActiveIndex(0);
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        ▾
      </button>
      {open && !disabled && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              className="de-search-menu de-search-menu--fixed"
              role="listbox"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight,
                transform: menuPos.above ? 'translateY(-100%)' : undefined,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {menuItems.length === 0 ? (
                <li className="de-search-empty">No matches</li>
              ) : (
                menuItems.map((item, index) =>
                  item.kind === 'create' ? (
                    <li key="create" role="option" aria-selected={false}>
                      <button
                        type="button"
                        className="de-search-option"
                        data-active={index === activeIndex ? 'true' : 'false'}
                        disabled={creating}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => void createTyped()}
                      >
                        <span className="de-search-option-label">
                          {creating ? 'Creating…' : `Create “${item.name}”`}
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li
                      key={`${item.option?.value}:${item.option?.label}`}
                      role="option"
                      aria-selected={item.option?.value === value}
                    >
                      <button
                        type="button"
                        className="de-search-option"
                        data-active={index === activeIndex ? 'true' : 'false'}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => item.option && pick(item.option.value)}
                      >
                        <span className="de-search-option-label">{item.option?.label}</span>
                        {item.option?.sublabel ? (
                          <span className="de-search-option-sub">{item.option.sublabel}</span>
                        ) : null}
                      </button>
                    </li>
                  ),
                )
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

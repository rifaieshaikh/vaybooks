import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled,
  className,
  onKeyDownAdvance,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

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

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? '');
      setActiveIndex(0);
    }
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div
      className={['de-search', className].filter(Boolean).join(' ')}
      ref={rootRef}
    >
      <input
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
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const opt = filtered[activeIndex];
            if (opt) pick(opt.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      {open && !disabled ? (
        <ul className="de-search-menu" role="listbox">
          {filtered.length === 0 ? (
            <li className="de-search-empty">No matches</li>
          ) : (
            filtered.map((opt, index) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className="de-search-option"
                  data-active={index === activeIndex ? 'true' : 'false'}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(opt.value)}
                >
                  <span className="de-search-option-label">{opt.label}</span>
                  {opt.sublabel ? (
                    <span className="de-search-option-sub">{opt.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

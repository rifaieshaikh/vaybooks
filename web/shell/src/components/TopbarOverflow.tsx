import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings } from 'lucide-react';
import { CREATE_ACTIONS, SETTINGS_SECTIONS, type NavItem } from '../navConfig';
import { NavGlyph } from './navIcons';

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  return ref;
}

export function CreateMenu({ filterItems }: { filterItems: (items: NavItem[]) => NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const items = filterItems(CREATE_ACTIONS);
  if (!items.length) return null;

  return (
    <div className="vb-popover" ref={ref}>
      <button
        type="button"
        className="vb-topbar-btn vb-topbar-btn-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Create"
        title="Create"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        <span>Create</span>
      </button>
      {open && (
        <div className="vb-popover-menu" role="menu">
          <div className="vb-popover-title">Create</div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className="vb-popover-item vb-popover-item-icon"
              onClick={() => setOpen(false)}
            >
              <NavGlyph name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsMenu({ filterItems }: { filterItems: (items: NavItem[]) => NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const sections = SETTINGS_SECTIONS.map((s) => ({
    title: s.title,
    items: filterItems(s.items),
  })).filter((s) => s.items.length > 0);

  if (!sections.length) return null;

  return (
    <div className="vb-popover" ref={ref}>
      <button
        type="button"
        className="vb-icon-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings size={18} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div className="vb-popover-menu vb-popover-menu-right vb-settings-menu" role="menu">
          <div
            className="vb-settings-grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(Math.max(sections.length, 1), 5)}, minmax(0, 1fr))`,
            }}
          >
            {sections.map((section) => (
              <div key={section.title} className="vb-settings-col">
                <div className="vb-popover-title">{section.title}</div>
                {section.items.map((item) => (
                  <Link
                    key={`${section.title}:${item.to}`}
                    to={item.to}
                    role="menuitem"
                    className="vb-popover-item vb-popover-item-icon"
                    onClick={() => setOpen(false)}
                  >
                    <NavGlyph name={item.icon} size={15} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

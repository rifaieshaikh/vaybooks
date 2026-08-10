import { createContext, useContext, type ReactNode } from 'react';

/** Chords for in-list keyboard nav (from Settings → Keyboard Shortcuts). */
export type ListKeyboardBindings = {
  search: string;
  next: string;
  prev: string;
  open: string;
  edit: string;
  new: string;
  filtersOpen: string;
  sortOpen: string;
  filtersApply: string;
  filtersClear: string;
  sortClear: string;
  prevPage: string;
  nextPage: string;
  filtersMtd: string;
  filtersLast30d: string;
  /** Document editor save (dialog.save). */
  save: string;
  /** Add line in document grid (form.add_line). */
  addLine: string;
  /** Remove line in document grid (form.remove_line). */
  removeLine: string;
  /** Back / dismiss to list (nav.back). */
  back: string;
  /** View row at index 0..8 (list.view_nth.1..9). */
  viewNth: string[];
  /** Edit row at index 0..8 (list.edit_nth.1..9). */
  editNth: string[];
};

function defaultNth(prefix: 'view' | 'edit'): string[] {
  return Array.from({ length: 9 }, (_, i) =>
    prefix === 'view' ? `alt+${i + 1}` : `alt+shift+${i + 1}`,
  );
}

export const DEFAULT_LIST_KEYBOARD_BINDINGS: ListKeyboardBindings = {
  search: '/',
  next: 'j',
  prev: 'k',
  open: 'enter',
  edit: 'e',
  new: 'n',
  filtersOpen: 'ctrl+alt+f',
  sortOpen: 'ctrl+shift+s',
  filtersApply: 'ctrl+enter',
  filtersClear: 'ctrl+1',
  sortClear: 'ctrl+2',
  prevPage: 'alt+left',
  nextPage: 'alt+right',
  filtersMtd: 'ctrl+alt+m',
  filtersLast30d: 'ctrl+alt+0',
  save: 'ctrl+s',
  addLine: 'ctrl+shift+.',
  removeLine: 'ctrl+shift+backspace',
  back: 'alt+backspace',
  viewNth: defaultNth('view'),
  editNth: defaultNth('edit'),
};

const ListKeyboardBindingsContext = createContext<ListKeyboardBindings>(
  DEFAULT_LIST_KEYBOARD_BINDINGS,
);

export function ListKeyboardBindingsProvider({
  value,
  children,
}: {
  value: ListKeyboardBindings;
  children: ReactNode;
}) {
  return (
    <ListKeyboardBindingsContext.Provider value={value}>
      {children}
    </ListKeyboardBindingsContext.Provider>
  );
}

export function useListKeyboardBindings(): ListKeyboardBindings {
  return useContext(ListKeyboardBindingsContext);
}

/** Build list bindings from Settings `actions` map. */
export function listBindingsFromActions(
  actions: Record<string, string> | null | undefined,
): ListKeyboardBindings {
  const a = actions || {};
  const pick = (key: string, fallback: string) =>
    String(a[key] || fallback).trim().toLowerCase() || fallback;
  return {
    search: pick('list.search.focus', DEFAULT_LIST_KEYBOARD_BINDINGS.search),
    next: pick('list.row.next', DEFAULT_LIST_KEYBOARD_BINDINGS.next),
    prev: pick('list.row.prev', DEFAULT_LIST_KEYBOARD_BINDINGS.prev),
    open: pick('list.row.open', DEFAULT_LIST_KEYBOARD_BINDINGS.open),
    edit: pick('list.row.edit', DEFAULT_LIST_KEYBOARD_BINDINGS.edit),
    new: pick('list.row.new', DEFAULT_LIST_KEYBOARD_BINDINGS.new),
    filtersOpen: pick('list.filters.open', DEFAULT_LIST_KEYBOARD_BINDINGS.filtersOpen),
    sortOpen: pick('list.sort.open', DEFAULT_LIST_KEYBOARD_BINDINGS.sortOpen),
    filtersApply: pick('list.filters.apply', DEFAULT_LIST_KEYBOARD_BINDINGS.filtersApply),
    filtersClear: pick('list.filters.clear', DEFAULT_LIST_KEYBOARD_BINDINGS.filtersClear),
    sortClear: pick('list.sort.clear', DEFAULT_LIST_KEYBOARD_BINDINGS.sortClear),
    prevPage: pick('list.prev_page', DEFAULT_LIST_KEYBOARD_BINDINGS.prevPage),
    nextPage: pick('list.next_page', DEFAULT_LIST_KEYBOARD_BINDINGS.nextPage),
    filtersMtd: pick('list.filters.mtd', DEFAULT_LIST_KEYBOARD_BINDINGS.filtersMtd),
    filtersLast30d: pick('list.filters.last_30d', DEFAULT_LIST_KEYBOARD_BINDINGS.filtersLast30d),
    save: pick('dialog.save', DEFAULT_LIST_KEYBOARD_BINDINGS.save),
    addLine: pick('form.add_line', DEFAULT_LIST_KEYBOARD_BINDINGS.addLine),
    removeLine: pick('form.remove_line', DEFAULT_LIST_KEYBOARD_BINDINGS.removeLine),
    back: pick('nav.back', DEFAULT_LIST_KEYBOARD_BINDINGS.back),
    viewNth: Array.from({ length: 9 }, (_, i) =>
      pick(`list.view_nth.${i + 1}`, DEFAULT_LIST_KEYBOARD_BINDINGS.viewNth[i] || `alt+${i + 1}`),
    ),
    editNth: Array.from({ length: 9 }, (_, i) =>
      pick(
        `list.edit_nth.${i + 1}`,
        DEFAULT_LIST_KEYBOARD_BINDINGS.editNth[i] || `alt+shift+${i + 1}`,
      ),
    ),
  };
}

export function eventChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta') return '';
  parts.push(key === ' ' ? 'space' : key);
  return parts.join('+');
}

/** Match event chord to a bound shortcut (with arrow ↔ j/k aliases). */
export function chordMatches(event: string, bound: string): boolean {
  const e = (event || '').toLowerCase();
  const b = (bound || '').toLowerCase();
  if (!e || !b) return false;
  if (e === b) return true;
  if (b === 'j' && e === 'arrowdown') return true;
  if (b === 'k' && e === 'arrowup') return true;
  if (b === 'arrowdown' && e === 'j') return true;
  if (b === 'arrowup' && e === 'k') return true;
  if (b === 'down' && (e === 'arrowdown' || e === 'j')) return true;
  if (b === 'up' && (e === 'arrowup' || e === 'k')) return true;
  if (b === 'alt+left' && (e === 'alt+arrowleft' || e === 'alt+left')) return true;
  if (b === 'alt+right' && (e === 'alt+arrowright' || e === 'alt+right')) return true;
  if (b === 'alt+arrowleft' && (e === 'alt+left' || e === 'alt+arrowleft')) return true;
  if (b === 'alt+arrowright' && (e === 'alt+right' || e === 'alt+arrowright')) return true;
  if (b === 'ctrl+shift+.' && (e === 'ctrl+shift+.' || e === 'ctrl+shift+period')) return true;
  if (b === 'ctrl+shift+backspace' && e === 'ctrl+shift+backspace') return true;
  return false;
}

export function formatChordHint(chord: string): string {
  const c = (chord || '').trim();
  if (!c) return '';
  return c
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'alt') return 'Alt';
      if (part === 'shift') return 'Shift';
      if (part === 'meta') return 'Meta';
      if (part === 'arrowdown') return '↓';
      if (part === 'arrowup') return '↑';
      if (part === 'arrowleft' || part === 'left') return '←';
      if (part === 'arrowright' || part === 'right') return '→';
      if (part === 'enter') return 'Enter';
      if (part === 'escape') return 'Esc';
      if (part === ' ') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    })
    .join('+');
}

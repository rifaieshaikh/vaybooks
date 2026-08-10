import { createContext, useContext, type ReactNode } from 'react';

/** Chords for in-list keyboard nav (from Settings → Keyboard Shortcuts). */
export type ListKeyboardBindings = {
  search: string;
  next: string;
  prev: string;
  open: string;
  edit: string;
  new: string;
};

export const DEFAULT_LIST_KEYBOARD_BINDINGS: ListKeyboardBindings = {
  search: '/',
  next: 'j',
  prev: 'k',
  open: 'enter',
  edit: 'e',
  new: 'n',
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
      if (part === 'arrowleft') return '←';
      if (part === 'arrowright') return '→';
      if (part === 'enter') return 'Enter';
      if (part === 'escape') return 'Esc';
      if (part === ' ') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    })
    .join('+');
}

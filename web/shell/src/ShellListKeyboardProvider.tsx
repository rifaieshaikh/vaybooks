import { useMemo, type ReactNode } from 'react';
import { useGetKeyboardShortcutsQuery } from '@vaybooks/store';
import {
  ListKeyboardBindingsProvider,
  listBindingsFromActions,
  DEFAULT_LIST_KEYBOARD_BINDINGS,
} from '@vaybooks/ui-kit';

/** Feeds Settings → Keyboard list-row chords into EntityListTable. */
export function ShellListKeyboardProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { data } = useGetKeyboardShortcutsQuery(undefined, { skip: !enabled });
  const value = useMemo(
    () =>
      enabled
        ? listBindingsFromActions((data?.actions || {}) as Record<string, string>)
        : DEFAULT_LIST_KEYBOARD_BINDINGS,
    [data?.actions, enabled],
  );
  return (
    <ListKeyboardBindingsProvider value={value}>{children}</ListKeyboardBindingsProvider>
  );
}

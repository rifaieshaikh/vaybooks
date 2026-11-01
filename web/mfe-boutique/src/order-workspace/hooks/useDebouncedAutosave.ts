import { useEffect, useRef } from 'react';

/** Debounced effect that skips the first render and in-flight races via generation counter. */
export function useDebouncedAutosave(
  enabled: boolean,
  deps: unknown[],
  delayMs: number,
  save: () => void | Promise<void>,
) {
  const gen = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const my = ++gen.current;
    const t = window.setTimeout(() => {
      if (my !== gen.current) return;
      void Promise.resolve(save());
    }, delayMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

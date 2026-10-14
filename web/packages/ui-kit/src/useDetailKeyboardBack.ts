import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chordMatches, eventChord, useListKeyboardBindings } from './ListKeyboard';

/** How many detail pages currently own Escape / nav.back (for shell skip). */
let detailBackOwners = 0;

export function hasActiveDetailKeyboardBack(): boolean {
  return detailBackOwners > 0;
}

/**
 * Escape or Settings `nav.back` → navigate to the list route.
 * Skips when typing or a dialog is open.
 */
export function useDetailKeyboardBack(backTo: string, enabled = true) {
  const navigate = useNavigate();
  const { back } = useListKeyboardBindings();

  useEffect(() => {
    if (!enabled || !backTo) return;
    detailBackOwners += 1;
    return () => {
      detailBackOwners = Math.max(0, detailBackOwners - 1);
    };
  }, [backTo, enabled]);

  useEffect(() => {
    if (!enabled || !backTo) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (document.querySelector('[role="dialog"], .vb-modal, .modal-open')) return;

      const chord = eventChord(e);
      const isEscape = e.key === 'Escape';
      if (!isEscape && !(chord && chordMatches(chord, back))) return;
      e.preventDefault();
      navigate(backTo);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [back, backTo, enabled, navigate]);
}

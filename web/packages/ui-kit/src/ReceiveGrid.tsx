import { useEffect, useRef } from 'react';
import { formatInr } from './DocumentEditor';
import {
  chordMatches,
  eventChord,
  useListKeyboardBindings,
} from './ListKeyboard';
import './DocumentEditor.css';

export type ReceiveSourceLine = {
  id: string;
  productLabel: string;
  orderedQty: number;
  receivedQty: number;
  rate: number;
};

export type ReceiveGridProps = {
  lines: ReceiveSourceLine[];
  onChange: (lines: ReceiveSourceLine[]) => void;
  disabled?: boolean;
  orderedLabel?: string;
  receivedLabel?: string;
};

export function ReceiveGrid({
  lines,
  onChange,
  disabled,
  orderedLabel = 'Ordered',
  receivedLabel = 'Received',
}: ReceiveGridProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bindings = useListKeyboardBindings();

  function updateQty(index: number, receivedQty: number) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, receivedQty } : line)),
    );
  }

  function fillRemaining() {
    if (disabled || lines.length === 0) return;
    onChange(
      lines.map((line) => ({
        ...line,
        receivedQty: Math.max(0, Number(line.orderedQty) || 0),
      })),
    );
  }

  function zeroAll() {
    if (disabled || lines.length === 0) return;
    onChange(lines.map((line) => ({ ...line, receivedQty: 0 })));
  }

  useEffect(() => {
    if (disabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const chord = eventChord(e);
      if (!chord) return;

      if (chordMatches(chord, bindings.addLine)) {
        e.preventDefault();
        fillRemaining();
        return;
      }
      if (chordMatches(chord, bindings.removeLine)) {
        e.preventDefault();
        zeroAll();
        return;
      }

      // Enter in a qty cell → next qty input
      if (chord !== 'enter') return;
      const target = e.target;
      if (!(target instanceof HTMLInputElement) || !wrap.contains(target)) return;
      const inputs = Array.from(
        wrap.querySelectorAll<HTMLInputElement>('input.de-cell-input:not([disabled])'),
      );
      const idx = inputs.indexOf(target);
      if (idx < 0) return;
      e.preventDefault();
      const next = inputs[idx + 1];
      if (next) {
        next.focus();
        next.select();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fill/zero close over latest lines via onChange
  }, [bindings.addLine, bindings.removeLine, disabled, lines, onChange]);

  return (
    <div className="de-grid-wrap" ref={wrapRef}>
      <div className="de-grid-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          className="el-btn-ghost"
          disabled={disabled || lines.length === 0}
          data-kb-action="form.add_line"
          onClick={fillRemaining}
          title="Fill received = ordered (form.add_line)"
        >
          Fill remaining
        </button>
        <button
          type="button"
          className="el-btn-ghost"
          disabled={disabled || lines.length === 0}
          data-kb-action="form.remove_line"
          onClick={zeroAll}
          title="Zero received qty (form.remove_line)"
        >
          Zero all
        </button>
      </div>
      <table className="de-grid">
        <thead>
          <tr>
            <th>Product</th>
            <th>{orderedLabel}</th>
            <th>{receivedLabel}</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="de-readonly">
                No source lines
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={line.id}>
                <td>{line.productLabel}</td>
                <td className="de-num de-readonly">{line.orderedQty}</td>
                <td>
                  <input
                    className="de-cell-input"
                    type="number"
                    min={0}
                    step="any"
                    value={line.receivedQty}
                    disabled={disabled}
                    onChange={(e) =>
                      updateQty(
                        index,
                        e.target.value === '' ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </td>
                <td className="de-num de-readonly">{formatInr(line.rate)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import type { KeyboardEvent } from 'react';
import './DocumentEditor.css';

export type DiscountMode = 'flat' | 'percent';

export type DiscountInputProps = {
  value: number;
  mode: DiscountMode;
  onChange: (next: { value: number; mode: DiscountMode }) => void;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
};

export function DiscountInput({
  value,
  mode,
  onChange,
  disabled,
  className,
  onKeyDown,
}: DiscountInputProps) {
  return (
    <div className={['de-discount', className].filter(Boolean).join(' ')}>
      <select
        className="de-cell-input"
        value={mode}
        disabled={disabled}
        aria-label="Discount type"
        onKeyDown={onKeyDown}
        onChange={(e) =>
          onChange({ value, mode: e.target.value === 'percent' ? 'percent' : 'flat' })
        }
      >
        <option value="flat">₹</option>
        <option value="percent">%</option>
      </select>
      <input
        className="de-cell-input"
        type="number"
        min={0}
        step="any"
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        aria-label="Discount amount"
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const next = e.target.value === '' ? 0 : Number(e.target.value);
          onChange({ value: Number.isFinite(next) ? next : 0, mode });
        }}
      />
    </div>
  );
}

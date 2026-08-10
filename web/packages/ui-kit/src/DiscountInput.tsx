import './DocumentEditor.css';

export type DiscountMode = 'flat' | 'percent';

export type DiscountInputProps = {
  value: number;
  mode: DiscountMode;
  onChange: (next: { value: number; mode: DiscountMode }) => void;
  disabled?: boolean;
  className?: string;
};

export function DiscountInput({
  value,
  mode,
  onChange,
  disabled,
  className,
}: DiscountInputProps) {
  return (
    <div className={['de-discount', className].filter(Boolean).join(' ')}>
      <select
        value={mode}
        disabled={disabled}
        aria-label="Discount type"
        onChange={(e) =>
          onChange({ value, mode: e.target.value === 'percent' ? 'percent' : 'flat' })
        }
      >
        <option value="flat">₹</option>
        <option value="percent">%</option>
      </select>
      <input
        type="number"
        min={0}
        step="any"
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        aria-label="Discount amount"
        onChange={(e) => {
          const next = e.target.value === '' ? 0 : Number(e.target.value);
          onChange({ value: Number.isFinite(next) ? next : 0, mode });
        }}
      />
    </div>
  );
}

import type { KeyboardEvent } from 'react';
import { DiscountInput, type DiscountMode } from './DiscountInput';
import { SearchableSelect } from './SearchableSelect';
import { formatInr } from './DocumentEditor';
import './DocumentEditor.css';

export type LineProductOption = {
  id: string;
  label: string;
  hsn?: string;
  gstRate?: number;
  rate?: number;
  stock?: number;
};

export type EditorLineItem = {
  id: string;
  productId?: string;
  qty: number;
  rate: number;
  discountInput?: number;
  discountMode?: DiscountMode;
  /** Resolved rupee discount (display optional; Disc column edits input+mode) */
  discount?: number;
  hsn?: string;
  taxable?: number;
  gstRate?: number;
  tax?: number;
  total?: number;
};

export type LineItemsGridProps<T extends EditorLineItem = EditorLineItem> = {
  lines: T[];
  products: LineProductOption[];
  onChange: (lines: T[]) => void;
  onProductSelected?: (index: number, productId: string) => void;
  showDiscount?: boolean;
  disabled?: boolean;
};

function newBlankLine(): EditorLineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    qty: 1,
    rate: 0,
    discountInput: 0,
    discountMode: 'flat',
    discount: 0,
    hsn: '',
    taxable: 0,
    gstRate: 0,
    tax: 0,
    total: 0,
  };
}

function ensureTrailingBlank<T extends EditorLineItem>(lines: T[]): T[] {
  if (!lines.length) {
    return [newBlankLine() as T];
  }
  const last = lines[lines.length - 1];
  if (last.productId) {
    return [...lines, newBlankLine() as T];
  }
  return lines;
}

function money(n: number | undefined): string {
  return formatInr(Number(n) || 0);
}

export function LineItemsGrid<T extends EditorLineItem = EditorLineItem>({
  lines,
  products,
  onChange,
  onProductSelected,
  showDiscount = false,
  disabled,
}: LineItemsGridProps<T>) {
  const rows = ensureTrailingBlank(lines);
  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.label,
    sublabel:
      [
        p.hsn ? `HSN ${p.hsn}` : '',
        p.gstRate != null ? `${p.gstRate}%` : '',
        p.stock != null ? `Stock ${p.stock}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
  }));

  function updateAt(index: number, patch: Partial<T>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    // Drop trailing blanks except one empty row convention handled by ensureTrailingBlank on render;
    // persist without pure trailing blanks that weren't user-touched beyond the last product row.
    const trimmed = trimTrailingBlanks(next as T[]);
    onChange(trimmed);
  }

  function trimTrailingBlanks(list: T[]): T[] {
    const copy = [...list];
    while (copy.length > 1) {
      const last = copy[copy.length - 1];
      if (!last.productId) {
        copy.pop();
      } else {
        break;
      }
    }
    // Keep one blank if last has product — parent may omit it; we re-add on render.
    // For persistence: keep lines that have product OR are the sole blank starter.
    return copy.filter((row, i) => {
      if (row.productId) return true;
      // keep intermediate blanks that user may still edit? only trail blanks removed above
      return i === 0 && copy.every((r) => !r.productId);
    });
  }

  function removeAt(index: number) {
    const next = rows.filter((_, i) => i !== index) as T[];
    onChange(trimTrailingBlanks(next.length ? next : ([newBlankLine()] as T[])));
  }

  function focusNext(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const root = (e.currentTarget as HTMLElement).closest('.de-grid');
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input.de-cell-input:not([disabled]), button.de-del:not([disabled]), .de-search input',
      ),
    ).filter((el) => el.offsetParent !== null);
    const idx = focusable.indexOf(e.currentTarget as HTMLElement);
    const next = focusable[idx + 1] || focusable[0];
    next?.focus();
  }

  return (
    <div className="de-grid-wrap">
      <table className="de-grid">
        <thead>
          <tr>
            <th className="de-product">Product</th>
            <th>Qty</th>
            <th>Rate</th>
            {showDiscount ? <th>Disc</th> : null}
            <th>HSN</th>
            <th>Taxable</th>
            <th>GST%</th>
            <th>Tax</th>
            <th>Total</th>
            <th aria-label="Delete" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isBlank = !row.productId;
            return (
              <tr key={row.id}>
                <td className="de-product">
                  <SearchableSelect
                    options={productOptions}
                    value={row.productId || ''}
                    placeholder="Select product"
                    disabled={disabled}
                    onChange={(productId) => {
                      const product = products.find((p) => p.id === productId);
                      const base = {
                        ...row,
                        productId,
                        ...(onProductSelected
                          ? {}
                          : {
                              rate: product?.rate ?? row.rate,
                              hsn: product?.hsn ?? row.hsn,
                              gstRate: product?.gstRate ?? row.gstRate,
                            }),
                      } as T;
                      const next = rows.map((r, i) => (i === index ? base : r));
                      const trimmed = trimTrailingBlanks(next as T[]);
                      onChange(trimmed);
                      if (onProductSelected) {
                        const at = trimmed.findIndex((r) => r.id === row.id);
                        onProductSelected(at >= 0 ? at : trimmed.length - 1, productId);
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    className="de-cell-input"
                    type="number"
                    min={0}
                    step="any"
                    value={row.qty}
                    disabled={disabled || isBlank}
                    onKeyDown={focusNext}
                    onChange={(e) =>
                      updateAt(index, {
                        qty: e.target.value === '' ? 0 : Number(e.target.value),
                      } as Partial<T>)
                    }
                  />
                </td>
                <td>
                  <input
                    className="de-cell-input"
                    type="number"
                    min={0}
                    step="any"
                    value={row.rate}
                    disabled={disabled || isBlank}
                    onKeyDown={focusNext}
                    onChange={(e) =>
                      updateAt(index, {
                        rate: e.target.value === '' ? 0 : Number(e.target.value),
                      } as Partial<T>)
                    }
                  />
                </td>
                {showDiscount ? (
                  <td>
                    <DiscountInput
                      value={row.discountInput ?? row.discount ?? 0}
                      mode={row.discountMode ?? 'flat'}
                      disabled={disabled || isBlank}
                      onChange={({ value, mode }) =>
                        updateAt(index, {
                          discountInput: value,
                          discountMode: mode,
                        } as Partial<T>)
                      }
                    />
                  </td>
                ) : null}
                <td className="de-readonly">{row.hsn || '—'}</td>
                <td className="de-num de-readonly">{money(row.taxable)}</td>
                <td className="de-num de-readonly">
                  {row.gstRate != null && row.gstRate > 0 ? `${row.gstRate}` : '—'}
                </td>
                <td className="de-num de-readonly">{money(row.tax)}</td>
                <td className="de-num de-readonly">{money(row.total)}</td>
                <td>
                  {!isBlank ? (
                    <button
                      type="button"
                      className="de-del"
                      disabled={disabled}
                      onClick={() => removeAt(index)}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

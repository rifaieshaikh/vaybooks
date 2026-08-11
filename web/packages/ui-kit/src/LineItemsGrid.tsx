import { useEffect, useRef, type KeyboardEvent } from 'react';
import { DiscountInput, type DiscountMode } from './DiscountInput';
import { SearchableSelect } from './SearchableSelect';
import { formatInr, focusDocumentSave, deFocusables } from './DocumentEditor';
import { chordMatches, eventChord, useListKeyboardBindings } from './ListKeyboard';
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
  itemType?: 'product' | 'service';
  serviceId?: string;
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
  onServiceSelected?: (index: number, serviceId: string) => void;
  showDiscount?: boolean;
  disabled?: boolean;
  allowServices?: boolean;
  services?: LineProductOption[];
};

function lineHasItem(row: EditorLineItem, allowServices: boolean): boolean {
  if (allowServices) {
    return Boolean(row.productId || row.serviceId);
  }
  return Boolean(row.productId);
}

function newBlankLine(allowServices: boolean): EditorLineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    ...(allowServices ? { itemType: 'product' as const, serviceId: '' } : {}),
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

function ensureTrailingBlank<T extends EditorLineItem>(lines: T[], allowServices: boolean): T[] {
  if (!lines.length) {
    return [newBlankLine(allowServices) as T];
  }
  const last = lines[lines.length - 1];
  if (lineHasItem(last, allowServices)) {
    return [...lines, newBlankLine(allowServices) as T];
  }
  return lines;
}

function money(n: number | undefined): string {
  return formatInr(Number(n) || 0);
}

function toSelectOptions(items: LineProductOption[]) {
  return items.map((p) => ({
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
}

function focusQtyInRow(tr: Element | null | undefined) {
  const qty = tr?.querySelector<HTMLInputElement>(
    'td input.de-cell-input[type="number"]:not([disabled])',
  );
  qty?.focus();
  qty?.select?.();
}

export function LineItemsGrid<T extends EditorLineItem = EditorLineItem>({
  lines,
  products,
  onChange,
  onProductSelected,
  onServiceSelected,
  showDiscount = false,
  disabled,
  allowServices = false,
  services = [],
}: LineItemsGridProps<T>) {
  const rows = ensureTrailingBlank(lines, allowServices);
  const productOptions = toSelectOptions(products);
  const serviceOptions = toSelectOptions(services);
  const bindings = useListKeyboardBindings();
  const wrapRef = useRef<HTMLDivElement>(null);

  function trimTrailingBlanks(list: T[]): T[] {
    const copy = [...list];
    while (copy.length > 1) {
      const last = copy[copy.length - 1];
      if (!lineHasItem(last, allowServices)) {
        copy.pop();
      } else {
        break;
      }
    }
    return copy.filter((row, i) => {
      if (lineHasItem(row, allowServices)) return true;
      return i === 0 && copy.every((r) => !lineHasItem(r, allowServices));
    });
  }

  function updateAt(index: number, patch: Partial<T>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    const trimmed = trimTrailingBlanks(next as T[]);
    onChange(trimmed);
  }

  function removeAt(index: number) {
    const next = rows.filter((_, i) => i !== index) as T[];
    onChange(
      trimTrailingBlanks(next.length ? next : ([newBlankLine(allowServices)] as T[])),
    );
  }

  function focusNext(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    const root = (e.currentTarget as HTMLElement).closest('.de-grid');
    if (!root) return;
    const focusable = deFocusables(root);
    const current = e.currentTarget as HTMLElement;
    const idx = focusable.findIndex((el) => el === current || el.contains(current));
    const next = idx >= 0 ? focusable[idx + 1] : focusable[0];
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement && next.type === 'number') next.select?.();
      return;
    }
    focusDocumentSave(root.closest('.de-page'));
  }

  useEffect(() => {
    if (disabled) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      const page = wrapRef.current?.closest('.de-page');
      if (!page) return;
      const target = e.target;
      if (!(target instanceof Node) || !page.contains(target)) return;

      const chord = eventChord(e);
      if (!chord) return;

      if (chordMatches(chord, bindings.addLine)) {
        e.preventDefault();
        const next = ensureTrailingBlank(
          [...trimTrailingBlanks(rows as T[]), newBlankLine(allowServices) as T],
          allowServices,
        ) as T[];
        onChange(next);
        return;
      }
      if (chordMatches(chord, bindings.removeLine)) {
        e.preventDefault();
        const el = target instanceof Element ? target : null;
        const tr = el?.closest('tr');
        const tbody = wrapRef.current?.querySelector('tbody');
        const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        let idx = tr && tbody ? trs.indexOf(tr as HTMLTableRowElement) : -1;
        if (idx < 0) {
          idx = rows.length - 1;
          while (idx > 0 && !lineHasItem(rows[idx], allowServices)) idx -= 1;
        }
        if (idx >= 0) removeAt(idx);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowServices, bindings.addLine, bindings.removeLine, disabled, onChange, rows]);

  return (
    <div className="de-grid-wrap" ref={wrapRef}>
      <table className="de-grid">
        <thead>
          <tr>
            {allowServices ? <th>Type</th> : null}
            <th className="de-product">{allowServices ? 'Item' : 'Product'}</th>
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
            const itemType = row.itemType === 'service' ? 'service' : 'product';
            const isBlank = !lineHasItem(row, allowServices);
            const itemOptions = itemType === 'service' ? serviceOptions : productOptions;
            const itemList = itemType === 'service' ? services : products;
            const itemValue =
              itemType === 'service' ? row.serviceId || '' : row.productId || '';
            return (
              <tr key={row.id} data-line-id={row.id}>
                {allowServices ? (
                  <td>
                    <select
                      className="de-cell-input"
                      value={itemType}
                      disabled={disabled}
                      onKeyDown={focusNext}
                      onChange={(e) => {
                        const nextType = e.target.value === 'service' ? 'service' : 'product';
                        updateAt(index, {
                          itemType: nextType,
                          ...(nextType === 'service'
                            ? { productId: '', serviceId: row.serviceId || '' }
                            : { serviceId: '', productId: row.productId || '' }),
                          rate: 0,
                          hsn: '',
                          gstRate: 0,
                          taxable: 0,
                          tax: 0,
                          total: 0,
                        } as Partial<T>);
                      }}
                    >
                      <option value="product">Product</option>
                      <option value="service">Service</option>
                    </select>
                  </td>
                ) : null}
                <td className="de-product">
                  <SearchableSelect
                    options={itemOptions}
                    value={itemValue}
                    placeholder={
                      allowServices
                        ? itemType === 'service'
                          ? 'Select service'
                          : 'Select product'
                        : 'Select product'
                    }
                    disabled={disabled}
                    onKeyDownAdvance={focusNext}
                    onChange={(selectedId) => {
                      const item = itemList.find((p) => p.id === selectedId);
                      if (itemType === 'service') {
                        const base = {
                          ...row,
                          itemType: 'service' as const,
                          serviceId: selectedId,
                          productId: '',
                          ...(onServiceSelected
                            ? {}
                            : {
                                rate: item?.rate ?? row.rate,
                                hsn: item?.hsn ?? row.hsn,
                                gstRate: item?.gstRate ?? row.gstRate,
                              }),
                        } as T;
                        const next = rows.map((r, i) => (i === index ? base : r));
                        const trimmed = trimTrailingBlanks(next as T[]);
                        onChange(trimmed);
                        if (onServiceSelected) {
                          const at = trimmed.findIndex((r) => r.id === row.id);
                          onServiceSelected(at >= 0 ? at : trimmed.length - 1, selectedId);
                        }
                        requestAnimationFrame(() => {
                          const tr = document.querySelector(`tr[data-line-id="${row.id}"]`);
                          focusQtyInRow(tr);
                        });
                        return;
                      }
                      const base = {
                        ...row,
                        itemType: allowServices ? ('product' as const) : row.itemType,
                        productId: selectedId,
                        ...(allowServices ? { serviceId: '' } : {}),
                        ...(onProductSelected
                          ? {}
                          : {
                              rate: item?.rate ?? row.rate,
                              hsn: item?.hsn ?? row.hsn,
                              gstRate: item?.gstRate ?? row.gstRate,
                            }),
                      } as T;
                      const next = rows.map((r, i) => (i === index ? base : r));
                      const trimmed = trimTrailingBlanks(next as T[]);
                      onChange(trimmed);
                      if (onProductSelected) {
                        const at = trimmed.findIndex((r) => r.id === row.id);
                        onProductSelected(at >= 0 ? at : trimmed.length - 1, selectedId);
                      }
                      requestAnimationFrame(() => {
                        const tr = document.querySelector(`tr[data-line-id="${row.id}"]`);
                        focusQtyInRow(tr);
                      });
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
                      onKeyDown={focusNext}
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

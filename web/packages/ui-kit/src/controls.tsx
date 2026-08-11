import {
  createElement,
  forwardRef,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
}

export function Button({ children, variant = 'primary', style, className, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: '0.5rem 0.95rem',
    borderRadius: 'var(--vb-control-radius, 8px)',
    border: variant === 'ghost' ? '1px solid var(--vb-color-control-border, #c5d4ce)' : 'none',
    background:
      variant === 'primary'
        ? 'var(--vb-color-primary, #185c4c)'
        : variant === 'danger'
          ? 'var(--vb-color-danger, #b42318)'
          : 'transparent',
    color:
      variant === 'primary' || variant === 'danger'
        ? 'var(--vb-color-on-primary, #fff)'
        : 'inherit',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'var(--vb-control-font-size, 0.925rem)',
    lineHeight: 1.3,
    ...style,
  };
  return createElement(
    'button',
    { type: 'button', className, style: base, ...props },
    children,
  );
}

export interface DataTableColumn<T> {
  key: keyof T & string;
  header: string;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  return createElement(
    'table',
    {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14,
        fontFamily: 'inherit',
      },
    },
    createElement(
      'thead',
      null,
      createElement(
        'tr',
        null,
        ...columns.map((col) =>
          createElement(
            'th',
            {
              key: col.key,
              style: {
                textAlign: 'left',
                borderBottom: '2px solid var(--vb-color-primary, #185c4c)',
                padding: '0.5rem',
              },
            },
            col.header,
          ),
        ),
      ),
    ),
    createElement(
      'tbody',
      null,
      data.length === 0
        ? createElement(
            'tr',
            null,
            createElement(
              'td',
              { colSpan: columns.length, style: { padding: '1rem', color: '#666' } },
              'No rows',
            ),
          )
        : data.map((row) =>
            createElement(
              'tr',
              {
                key: rowKey(row),
                onClick: onRowClick ? () => onRowClick(row) : undefined,
                style: { cursor: onRowClick ? 'pointer' : 'default' },
              },
              ...columns.map((col) =>
                createElement(
                  'td',
                  {
                    key: col.key,
                    style: { borderBottom: '1px solid #eee', padding: '0.5rem' },
                  },
                  String(row[col.key] ?? ''),
                ),
              ),
            ),
          ),
    ),
  );
}

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        gap: '1rem',
      },
    },
    createElement('h2', { style: { margin: 0, color: 'var(--vb-color-primary, #185c4c)' } }, title),
    actions ?? null,
  );
}

export function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return createElement('label', { className: 'vb-label' }, label, children);
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, style, ...props }, ref) {
    return createElement('input', {
      ...props,
      ref,
      className: cx('vb-control', className),
      style,
    });
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, style, children, ...props }, ref) {
    return createElement(
      'select',
      {
        ...props,
        ref,
        className: cx('vb-control', className),
        style,
      },
      children,
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, style, ...props }, ref) {
    return createElement('textarea', {
      ...props,
      ref,
      className: cx('vb-control', className),
      style: { minHeight: '5.5rem', resize: 'vertical', ...(style || {}) },
    });
  },
);

export function SimpleForm({
  onSubmit,
  children,
}: {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return createElement(
    'form',
    {
      onSubmit: (e: FormEvent) => {
        e.preventDefault();
        onSubmit(e);
      },
      style: {
        display: 'grid',
        gap: 10,
        maxWidth: 420,
        marginBottom: 16,
        padding: 12,
        background: 'var(--vb-color-soft, #eef5f1)',
        borderRadius: 'var(--vb-control-radius, 8px)',
        fontFamily: 'inherit',
      },
    },
    children,
  );
}

export function StatusBanner({ children }: { children: ReactNode }) {
  return createElement(
    'div',
    {
      style: {
        padding: '0.75rem 1rem',
        background: '#fff7e6',
        border: '1px solid #f0c36d',
        borderRadius: 'var(--vb-control-radius, 8px)',
        marginBottom: 12,
        fontFamily: 'inherit',
      },
    },
    children,
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return createElement('p', { style: { color: '#b00020', fontFamily: 'inherit' } }, children);
}

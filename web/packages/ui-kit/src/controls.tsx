import { createElement, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
}

export function Button({ children, variant = 'primary', style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: '0.45rem 0.9rem',
    borderRadius: 6,
    border: variant === 'ghost' ? '1px solid #ccc' : 'none',
    background: variant === 'primary' ? 'var(--vb-color-primary, #185c4c)' : 'transparent',
    color: variant === 'primary' ? '#fff' : 'inherit',
    cursor: 'pointer',
    ...style,
  };
  return createElement('button', { type: 'button', style: base, ...props }, children);
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
  return createElement(
    'label',
    { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8, fontSize: 14 } },
    label,
    children,
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return createElement('input', {
    ...props,
    style: {
      padding: '0.4rem 0.5rem',
      border: '1px solid #ccc',
      borderRadius: 4,
      ...(props.style || {}),
    },
  });
}

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
        gap: 8,
        maxWidth: 420,
        marginBottom: 16,
        padding: 12,
        background: '#f7faf8',
        borderRadius: 8,
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
        borderRadius: 6,
        marginBottom: 12,
      },
    },
    children,
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return createElement('p', { style: { color: '#b00020' } }, children);
}

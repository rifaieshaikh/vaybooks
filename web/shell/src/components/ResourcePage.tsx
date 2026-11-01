import type { FormEvent, ReactNode } from 'react';
import { Button, DataTable, ErrorText, FormRow, PageHeader, SimpleForm, TextInput } from '@vaybooks/ui-kit';

type Col = { key: string; header: string };

export function ResourcePage({
  title,
  columns,
  rows,
  isLoading,
  error,
  onRefresh,
  form,
}: {
  title: string;
  columns: Col[];
  rows: Record<string, unknown>[];
  isLoading?: boolean;
  error?: unknown;
  onRefresh?: () => void;
  form?: ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        actions={
          onRefresh ? (
            <Button variant="ghost" onClick={onRefresh}>
              Refresh
            </Button>
          ) : undefined
        }
      />
      {form}
      {isLoading && <p>Loading…</p>}
      {error ? <ErrorText>Failed to load data. Is the API running on :8000?</ErrorText> : null}
      <DataTable
        columns={columns as { key: keyof Record<string, unknown> & string; header: string }[]}
        data={rows}
        rowKey={(row) => String(row.id ?? JSON.stringify(row))}
      />
    </div>
  );
}

export function CreateForm({
  fields,
  onSubmit,
  submitLabel = 'Create',
}: {
  fields: { name: string; label: string; type?: string; placeholder?: string; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  submitLabel?: string;
}) {
  async function handleSubmit(e: FormEvent) {
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const values: Record<string, string> = {};
    fields.forEach((f) => {
      values[f.name] = String(fd.get(f.name) ?? '');
    });
    await onSubmit(values);
    form.reset();
  }

  return (
    <SimpleForm onSubmit={handleSubmit}>
      {fields.map((f) => (
        <FormRow key={f.name} label={f.label}>
          <TextInput
            name={f.name}
            type={f.type ?? 'text'}
            placeholder={f.placeholder}
            required={f.required !== false}
          />
        </FormRow>
      ))}
      <Button type="submit">{submitLabel}</Button>
    </SimpleForm>
  );
}

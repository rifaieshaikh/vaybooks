import { useMemo, useState } from 'react';
import {
  useImportCrmLeadsCommitMutation,
  useImportCrmLeadsDryRunMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow, Modal } from '@vaybooks/ui-kit';
import { extractError } from '../utils';
import { LocationSelect } from './LocationSelect';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    return row;
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
};

/** Paste/upload CSV → dry-run → commit lead import. */
export function ImportLeadsModal({ open, onClose, onImported }: Props) {
  const [dryRun, dryRunState] = useImportCrmLeadsDryRunMutation();
  const [commit, commitState] = useImportCrmLeadsCommitMutation();
  const [raw, setRaw] = useState('');
  const [filename, setFilename] = useState('upload.csv');
  const [locationId, setLocationId] = useState('');
  const [policy, setPolicy] = useState('skip');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const rows = useMemo(() => parseCsv(raw), [raw]);

  function reset() {
    setRaw('');
    setFilename('upload.csv');
    setLocationId('');
    setPolicy('skip');
    setPreview(null);
    setError('');
    setMsg('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFilename(file.name || 'upload.csv');
    setRaw(await file.text());
    setPreview(null);
    setMsg('');
  }

  async function onDryRun() {
    setError('');
    setMsg('');
    try {
      const result = await dryRun({
        rows,
        duplicate_policy: policy,
        location_id: locationId,
        source_filename: filename,
      }).unwrap();
      setPreview(result);
      setMsg(`Dry-run complete · ${Number(result.total_rows || rows.length)} rows`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onCommit() {
    setError('');
    setMsg('');
    try {
      const result = await commit({
        rows,
        duplicate_policy: policy,
        location_id: locationId,
        source_filename: filename,
      }).unwrap();
      setMsg(
        `Imported · created ${Number(result.created_count || 0)}, updated ${Number(result.updated_count || 0)}, skipped ${Number(result.skipped_count || 0)}`,
      );
      onImported?.();
      setTimeout(() => handleClose(), 600);
    } catch (e) {
      setError(extractError(e));
    }
  }

  const outcomes = Array.isArray(preview?.outcomes) ? (preview.outcomes as Record<string, unknown>[]) : [];

  return (
    <Modal
      open={open}
      title="Import leads"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onDryRun()}
            disabled={rows.length === 0 || dryRunState.isLoading}
          >
            {dryRunState.isLoading ? 'Checking…' : 'Dry-run'}
          </Button>
          <Button
            type="button"
            onClick={() => void onCommit()}
            disabled={rows.length === 0 || !preview || commitState.isLoading}
          >
            {commitState.isLoading ? 'Importing…' : 'Commit import'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {msg ? <p style={{ margin: 0 }}>{msg}</p> : null}
        <FormRow label="CSV file">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
        </FormRow>
        <FormRow label="Paste CSV">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setPreview(null);
            }}
            rows={8}
            placeholder="name,phone,email,source&#10;Acme Traders,9876543210,…"
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
        </FormRow>
        <LocationSelect value={locationId} onChange={setLocationId} />
        <FormRow label="Duplicate policy">
          <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
            <option value="skip">Skip duplicates</option>
            <option value="update">Update existing</option>
            <option value="import_as_separate">Import as separate</option>
            <option value="link_to_customer">Link to customer</option>
          </select>
        </FormRow>
        <p className="el-muted" style={{ margin: 0, fontSize: 13 }}>
          Parsed rows: {rows.length}
        </p>
        {outcomes.length > 0 ? (
          <div
            style={{
              maxHeight: 180,
              overflow: 'auto',
              border: '1px solid var(--vb-color-border, #e5e7eb)',
              borderRadius: 6,
              padding: 8,
              fontSize: 12,
            }}
          >
            {outcomes.slice(0, 40).map((row, i) => (
              <div key={i}>
                #{Number(row.row ?? i) + 1} {String(row.name || '—')} ·{' '}
                {row.would_create ? 'would create' : 'duplicate'}
              </div>
            ))}
            {outcomes.length > 40 ? (
              <div className="el-muted">…and {outcomes.length - 40} more</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

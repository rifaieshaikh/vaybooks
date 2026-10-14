export function formatMoney(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Human-readable field for cards — never dump objects / embedded SOR JSON. */
export function asCaption(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return '';

  let text = value
    // HTML comment meta: <!--ALLOC_INVOICE:{...}-->
    .replace(/<!--\s*[A-Z0-9_]+\s*:[\s\S]*?-->/g, '');

  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    let stripped = line.trim();
    if (!stripped) continue;
    if (/^LINES_JSON:/i.test(stripped)) continue;
    if (
      (stripped.startsWith('{') && stripped.endsWith('}')) ||
      (stripped.startsWith('[') && stripped.endsWith(']'))
    ) {
      continue;
    }
    const brace = stripped.indexOf('{');
    if (brace > 0) {
      const after = stripped.slice(brace).trim();
      if (after.endsWith('}') || after.startsWith('{"')) {
        stripped = stripped.slice(0, brace).trim();
        if (!stripped) continue;
      }
    }
    kept.push(stripped);
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    return String((e as { data?: { detail?: string } }).data?.detail || 'Request failed');
  }
  return 'Request failed';
}

export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

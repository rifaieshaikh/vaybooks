export function asCaption(value: unknown): string {
  if (value == null) return '—';
  const text = String(value).trim();
  return text || '—';
}

export function extractError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Request failed';
  const e = err as { data?: unknown; error?: unknown };
  const data = e.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  if (typeof e.error === 'string') return e.error;
  return 'Request failed';
}

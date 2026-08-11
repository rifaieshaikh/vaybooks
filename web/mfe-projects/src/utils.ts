export function asCaption(value: unknown): string {
  if (value == null) return '—';
  const text = String(value).trim();
  return text || '—';
}

export function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDateInput(value: unknown): string {
  const text = String(value || '').trim();
  return text.slice(0, 10);
}

export function extractError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Request failed';
  const e = err as { data?: unknown; error?: unknown };
  const data = e.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join('; ');
    }
  }
  if (typeof e.error === 'string') return e.error;
  return 'Request failed';
}

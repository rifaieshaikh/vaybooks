export function asCaption(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function extractError(e: unknown): string {
  const detail = (e as { data?: { detail?: unknown } } | undefined)?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const msg = (d as { msg?: string; message?: string }).msg
            || (d as { message?: string }).message;
          if (msg) return String(msg);
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return 'Request failed';
}

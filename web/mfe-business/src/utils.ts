export function asCaption(value: unknown): string {
  return String(value ?? '').trim();
}

export function extractError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Request failed';
  const err = error as { data?: { detail?: unknown }; error?: string };
  const detail = err.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'object' && item && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item)))
      .join('; ');
  }
  if (err.error) return err.error;
  return 'Request failed';
}

export function unwrapPaged<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

import type { StatusPillTone } from '@vaybooks/ui-kit';
import { asCaption } from './utils';

export function boutiqueItemStatusTone(status: string): StatusPillTone {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'success';
  if (s.includes('progress')) return 'neutral';
  if (s.includes('pending') || s.includes('created')) return 'warn';
  return 'neutral';
}

export function boutiqueTaskStatus(row: Record<string, unknown>): string {
  return asCaption(row.status) || (asCaption(row.start_time) ? 'Completed' : 'Created');
}

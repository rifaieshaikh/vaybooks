import { statusPillTone, type StatusPillTone } from '@vaybooks/ui-kit';

export const BATCH_STATUSES = ['Draft', 'In Progress', 'Posted', 'Cancelled'] as const;

export const COST_TYPE_PRESETS = [
  'Labour',
  'Power',
  'Fuel',
  'Packing',
  'Freight',
  'Overhead',
  'Other',
] as const;

export const ALLOCATION_METHODS = [
  { value: 'NRV', label: 'NRV (by expected sales value)' },
  { value: 'Percentage', label: 'Percentage' },
  { value: 'Primary Absorbs All', label: 'Primary absorbs all' },
] as const;

export const OUTPUT_ROLES = ['Main', 'Co-product', 'By-product', 'Scrap'] as const;

export function batchStatusTone(status: string): StatusPillTone {
  const value = status.trim().toLowerCase();
  if (value === 'posted') return 'success';
  if (value === 'in progress') return 'warn';
  if (value === 'cancelled') return 'danger';
  return statusPillTone(status) || 'neutral';
}

export function recipeActiveTone(active: boolean): StatusPillTone {
  return active ? 'success' : 'neutral';
}

export function completeVsPostCopy(): string {
  return 'Complete = finish work. Post = update stock and books.';
}

export function settingsIncomplete(settings: Record<string, unknown> | undefined): string[] {
  if (!settings) return ['Settings not loaded'];
  const missing: string[] = [];
  if (!String(settings.wip_account_id || '').trim()) missing.push('WIP account');
  if (!String(settings.raw_material_account_id || '').trim()) missing.push('Raw material account');
  if (!String(settings.finished_goods_account_id || '').trim()) missing.push('Finished goods account');
  return missing;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function periodRange(
  preset: 'today' | 'week' | 'month' | 'custom',
  customStart = '',
  customEnd = '',
): { start_date?: string; end_date?: string } {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  if (preset === 'today') return { start_date: end, end_date: end };
  if (preset === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start_date: start.toISOString().slice(0, 10), end_date: end };
  }
  if (preset === 'month') {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { start_date: start.toISOString().slice(0, 10), end_date: end };
  }
  return {
    start_date: customStart || undefined,
    end_date: customEnd || undefined,
  };
}

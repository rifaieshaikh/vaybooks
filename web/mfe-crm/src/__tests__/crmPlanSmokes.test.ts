import { describe, expect, it } from 'vitest';
import {
  applySavedListView,
  crmDetailPath,
  daysPastDue,
  groupByAgingBucket,
} from '../collectionsAging';
import { parseEntityWorkspaceTab } from '../components/EntityWorkspace';
import { crmStatusTone } from '../components/StatusPill';

describe('parseEntityWorkspaceTab', () => {
  it('parses known tabs and falls back', () => {
    expect(parseEntityWorkspaceTab('timeline')).toBe('timeline');
    expect(parseEntityWorkspaceTab('audit')).toBe('audit');
    expect(parseEntityWorkspaceTab('nope')).toBe('details');
    expect(parseEntityWorkspaceTab(null, 'files')).toBe('files');
  });
});

describe('crmStatusTone', () => {
  it('maps catalog statuses', () => {
    expect(crmStatusTone('New')).toBe('new');
    expect(crmStatusTone('Converted')).toBe('ok');
    expect(crmStatusTone('Lost')).toBe('danger');
    expect(crmStatusTone('Scheduled')).toBe('new');
    expect(crmStatusTone('Completed')).toBe('ok');
  });
});

describe('collections aging', () => {
  const today = new Date('2026-08-10T12:00:00Z');

  it('computes days_past_due from field or due_date', () => {
    expect(daysPastDue({ days_past_due: 45 }, today)).toBe(45);
    expect(daysPastDue({ due_date: '2026-08-10' }, today)).toBe(0);
    expect(daysPastDue({ due_date: '2026-07-11' }, today)).toBe(30);
    expect(daysPastDue({ name: 'no due' }, today)).toBeNull();
  });

  it('groups into Current / 1-30 / 31-60 / 61-90 / 90+ and skips without aging', () => {
    expect(groupByAgingBucket([{ id: '1', outstanding: 10 }], { today })).toEqual([]);

    const groups = groupByAgingBucket(
      [
        { id: 'a', days_past_due: 0 },
        { id: 'b', days_past_due: 15 },
        { id: 'c', days_past_due: 45 },
        { id: 'd', days_past_due: 75 },
        { id: 'e', days_past_due: 120 },
      ],
      { today },
    );
    expect(groups.map((g) => g.id)).toEqual(['current', '1-30', '31-60', '61-90', '90+']);
    expect(groups.find((g) => g.id === '1-30')?.rows).toHaveLength(1);
  });
});

describe('saved views + deleted detail path', () => {
  it('applies saved view search/filters/sort', () => {
    expect(
      applySavedListView({
        filters: { search: 'acme', status: 'New', assigned_user_id: 'u1' },
        sort: [{ key: 'name', desc: true }],
      }),
    ).toEqual({
      search: 'acme',
      filters: { status: 'New', assigned_user_id: 'u1' },
      sort: [{ key: 'name', desc: true }],
    });
  });

  it('builds deleted restore deep-link', () => {
    expect(crmDetailPath('leads', 'L1', { deleted: true, tab: 'details' })).toBe(
      '/crm/leads/L1?deleted=1&tab=details',
    );
    expect(crmDetailPath('leads', 'L1')).toBe('/crm/leads/L1');
  });
});

import type { StatusPillTone as EntityStatusPillTone } from '@vaybooks/ui-kit';

/** CRM status tones — maps onto EntityList pill styles where useful. */
export type CrmStatusPillTone = 'new' | 'ok' | 'warn' | 'danger' | 'muted';

const TONE_CLASS: Record<CrmStatusPillTone, string> = {
  new: 'el-status-pill el-status-pill--warn',
  ok: 'el-status-pill el-status-pill--success',
  warn: 'el-status-pill el-status-pill--warn',
  danger: 'el-status-pill el-status-pill--danger',
  muted: 'el-status-pill el-status-pill--neutral',
};

const ENTITY_TO_CRM: Record<EntityStatusPillTone, CrmStatusPillTone> = {
  neutral: 'muted',
  success: 'ok',
  warn: 'warn',
  danger: 'danger',
};

export function crmStatusTone(status: unknown): CrmStatusPillTone {
  const s = String(status || '').toLowerCase();
  if (!s) return 'muted';
  if (s === 'new' || s.includes('new')) return 'new';
  if (
    s.includes('cancel') ||
    s.includes('lost') ||
    s.includes('reject') ||
    s.includes('void') ||
    s.includes('fail')
  ) {
    return 'danger';
  }
  if (
    s.includes('convert') ||
    s.includes('complete') ||
    s.includes('won') ||
    s.includes('qualified') ||
    s.includes('done') ||
    s.includes('paid')
  ) {
    return 'ok';
  }
  if (
    s.includes('pending') ||
    s.includes('follow') ||
    s.includes('hold') ||
    s.includes('due') ||
    s.includes('overdue') ||
    s.includes('contact')
  ) {
    return 'warn';
  }
  return 'muted';
}

export function StatusPill({
  status,
  tone,
  label,
}: {
  status?: unknown;
  tone?: CrmStatusPillTone | EntityStatusPillTone;
  label?: string;
}) {
  const text = (label ?? String(status ?? '')).trim();
  if (!text) return <span className="el-muted">—</span>;

  let resolved: CrmStatusPillTone;
  if (tone) {
    resolved =
      tone in TONE_CLASS
        ? (tone as CrmStatusPillTone)
        : ENTITY_TO_CRM[tone as EntityStatusPillTone] || 'muted';
  } else {
    resolved = crmStatusTone(status ?? text);
  }

  return <span className={TONE_CLASS[resolved]}>{text}</span>;
}

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

/**
 * Canonical CRM catalog statuses (defaults from domain enums / settings catalogs).
 * Exact match first; substring heuristics only as fallback for custom labels.
 */
const KNOWN_STATUS_TONES: Record<string, CrmStatusPillTone> = {
  // LeadStatus
  new: 'new',
  contacted: 'warn',
  qualified: 'ok',
  'follow-up required': 'warn',
  'follow up required': 'warn',
  interested: 'ok',
  'not interested': 'danger',
  converted: 'ok',
  lost: 'danger',
  'on hold': 'muted',
  // EnquiryStatus
  open: 'new',
  assigned: 'warn',
  'in progress': 'warn',
  'quotation required': 'warn',
  'quotation sent': 'warn',
  negotiation: 'warn',
  won: 'ok',
  closed: 'muted',
  // ActivityStatus
  scheduled: 'new',
  completed: 'ok',
  cancelled: 'danger',
  canceled: 'danger',
  missed: 'danger',
  reversed: 'muted',
};

export function crmStatusTone(status: unknown): CrmStatusPillTone {
  const raw = String(status || '').trim();
  if (!raw) return 'muted';

  const key = raw.toLowerCase();
  const known = KNOWN_STATUS_TONES[key];
  if (known) return known;

  // Catalog-aware substring fallbacks for custom / renamed statuses
  if (key.includes('cancel') || key.includes('lost') || key.includes('reject') || key.includes('void') || key.includes('fail') || key.includes('missed')) {
    return 'danger';
  }
  if (
    key.includes('convert') ||
    key.includes('complete') ||
    key.includes('won') ||
    key.includes('qualified') ||
    key.includes('done') ||
    key.includes('paid')
  ) {
    return 'ok';
  }
  if (key === 'new' || key.startsWith('new ') || key.endsWith(' new') || key.includes('scheduled')) {
    return 'new';
  }
  if (
    key.includes('pending') ||
    key.includes('follow') ||
    key.includes('hold') ||
    key.includes('due') ||
    key.includes('overdue') ||
    key.includes('contact') ||
    key.includes('progress') ||
    key.includes('negotiat') ||
    key.includes('quotat') ||
    key.includes('assign')
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

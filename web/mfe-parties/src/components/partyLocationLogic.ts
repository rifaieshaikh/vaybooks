export type AccessibleLocation = { id: string; code?: string; name?: string };

export type PartyLocationContext = {
  workingLocationId: string;
  accessible: AccessibleLocation[];
};

/** Empty or legacy `"default"` only — not real location ids. */
export function normalizeRealLocationIds(ids: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = String(raw || '').trim();
    if (!id || id === 'default' || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function shouldShowPartyLocationPicker(ctx: PartyLocationContext): boolean {
  return ctx.workingLocationId === 'ALL' && ctx.accessible.length > 1;
}

export function soleOrWorkingLocationId(ctx: PartyLocationContext): string {
  if (ctx.workingLocationId && ctx.workingLocationId !== 'ALL') {
    return ctx.workingLocationId;
  }
  return String(ctx.accessible[0]?.id || '').trim();
}

export function initialSelectedLocationIds(
  mode: 'create' | 'edit',
  ctx: PartyLocationContext,
  existingIds?: string[] | null,
): string[] {
  const accessibleIds = ctx.accessible.map((l) => String(l.id));
  const accessibleSet = new Set(accessibleIds);
  const show = shouldShowPartyLocationPicker(ctx);
  const existing = normalizeRealLocationIds(existingIds);

  if (!show) {
    if (mode === 'edit' && existing.length) return existing.filter((id) => accessibleSet.has(id));
    const sole = soleOrWorkingLocationId(ctx);
    return sole ? [sole] : [];
  }

  if (mode === 'create') return accessibleIds;
  if (!existing.length) return accessibleIds;
  const selected = existing.filter((id) => accessibleSet.has(id));
  return selected.length ? selected : accessibleIds;
}

/**
 * Resolve location_ids for create/update.
 * When picker is shown on edit: selectedAccessible ∪ existing outside accessible.
 */
export function resolvePartyLocationIdsForSave(args: {
  mode: 'create' | 'edit';
  ctx: PartyLocationContext;
  selectedIds: string[];
  existingIds?: string[] | null;
}): { locationIds: string[]; error: string | null } {
  const { mode, ctx, selectedIds, existingIds } = args;
  const accessibleIds = ctx.accessible.map((l) => String(l.id));
  const accessibleSet = new Set(accessibleIds);
  const show = shouldShowPartyLocationPicker(ctx);
  const existing = normalizeRealLocationIds(existingIds);
  const selected = normalizeRealLocationIds(selectedIds).filter((id) => accessibleSet.has(id));

  if (!show) {
    if (mode === 'edit' && existing.length) {
      return { locationIds: existing, error: null };
    }
    const sole = soleOrWorkingLocationId(ctx);
    if (!sole) {
      return { locationIds: [], error: 'Select a working location before saving.' };
    }
    return { locationIds: [sole], error: null };
  }

  if (!selected.length) {
    return { locationIds: [], error: 'Select at least one location where this party is visible.' };
  }

  if (mode === 'create') {
    return { locationIds: selected, error: null };
  }

  const preserved = existing.filter((id) => !accessibleSet.has(id));
  const merged = [...selected];
  for (const id of preserved) {
    if (!merged.includes(id)) merged.push(id);
  }
  return { locationIds: merged, error: null };
}

export function partyListLocationParams(ctx: PartyLocationContext | null | undefined): {
  location_id?: string;
  location_ids?: string;
} | null {
  if (!ctx) return null;
  const working = String(ctx.workingLocationId || '').trim();
  if (!working) return null;
  if (working === 'ALL') {
    const ids = ctx.accessible.map((l) => String(l.id)).filter(Boolean);
    if (!ids.length) return null;
    return { location_ids: ids.join(',') };
  }
  return { location_id: working };
}

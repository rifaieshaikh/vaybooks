/**
 * Lightweight node assertions for party location pure helpers.
 * Run: npx --yes tsx src/components/partyLocationLogic.selftest.ts
 */
import {
  initialSelectedLocationIds,
  normalizeRealLocationIds,
  partyListLocationParams,
  resolvePartyLocationIdsForSave,
  shouldShowPartyLocationPicker,
  soleOrWorkingLocationId,
} from './partyLocationLogic';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const multiAll = {
  workingLocationId: 'ALL',
  accessible: [
    { id: 'loc-a', name: 'A' },
    { id: 'loc-b', name: 'B' },
  ],
};

const specific = {
  workingLocationId: 'loc-a',
  accessible: [
    { id: 'loc-a', name: 'A' },
    { id: 'loc-b', name: 'B' },
  ],
};

const single = {
  workingLocationId: 'loc-a',
  accessible: [{ id: 'loc-a', name: 'A' }],
};

assert(normalizeRealLocationIds(['default', '', 'loc-a', 'loc-a']).join() === 'loc-a', 'normalize');
assert(shouldShowPartyLocationPicker(multiAll) === true, 'show when ALL+2');
assert(shouldShowPartyLocationPicker(specific) === false, 'hide when specific');
assert(shouldShowPartyLocationPicker(single) === false, 'hide when single');
assert(soleOrWorkingLocationId(specific) === 'loc-a', 'sole/working');
assert(
  initialSelectedLocationIds('create', multiAll).join() === 'loc-a,loc-b',
  'create all accessible',
);
assert(initialSelectedLocationIds('create', specific).join() === 'loc-a', 'create stamp');

const editUnion = resolvePartyLocationIdsForSave({
  mode: 'edit',
  ctx: multiAll,
  selectedIds: ['loc-a'],
  existingIds: ['loc-a', 'loc-secret'],
});
assert(editUnion.error === null, 'union ok');
assert(editUnion.locationIds.join() === 'loc-a,loc-secret', 'preserve inaccessible');

const hiddenEdit = resolvePartyLocationIdsForSave({
  mode: 'edit',
  ctx: specific,
  selectedIds: [],
  existingIds: ['loc-a', 'loc-b'],
});
assert(hiddenEdit.locationIds.join() === 'loc-a,loc-b', 'preserve when hidden');

const repair = resolvePartyLocationIdsForSave({
  mode: 'edit',
  ctx: specific,
  selectedIds: [],
  existingIds: ['default'],
});
assert(repair.locationIds.join() === 'loc-a', 'repair legacy default');

assert(partyListLocationParams(specific)?.location_id === 'loc-a', 'list specific');
assert(partyListLocationParams(multiAll)?.location_ids === 'loc-a,loc-b', 'list ALL');

console.log('partyLocationLogic.selftest: ok');

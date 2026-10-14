import { useGetWorkingLocationQuery } from '@vaybooks/store';

/** Session working location id for stamping docs — never shown in UI. */
export function useWorkingLocation() {
  const { data: workingLoc } = useGetWorkingLocationQuery();
  const locationId = String(workingLoc?.working_location_id || '').trim();
  return { locationId, hasLocation: Boolean(locationId) };
}

/** Resolve location for create (working) vs edit (document). */
export function resolveDocLocationId(
  isEdit: boolean,
  workingLocationId: string,
  existingLocationId?: string,
): string {
  if (isEdit) return String(existingLocationId || workingLocationId || '').trim();
  return String(workingLocationId || '').trim();
}

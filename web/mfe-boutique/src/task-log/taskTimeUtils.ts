/** Parse "HH:MM" or "HH:MM:SS" to minutes from midnight. */
export function parseTimeToMinutes(value: string): number | null {
  const text = String(value || '').trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Format minutes from midnight as "HH:MM". */
export function formatMinutesAsTime(total: number): string {
  const normalized = ((Math.round(total) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Add fractional hours to a start time; returns end time and whether it crossed midnight. */
export function endTimeFromDuration(
  startTime: string,
  hoursTaken: number,
): { endTime: string; endsNextDay: boolean } | null {
  const start = parseTimeToMinutes(startTime);
  if (start == null || !Number.isFinite(hoursTaken) || hoursTaken <= 0) return null;
  const added = Math.round(hoursTaken * 60);
  const end = start + added;
  return {
    endTime: formatMinutesAsTime(end),
    endsNextDay: end >= 24 * 60,
  };
}

export function durationHoursFromRange(
  startTime: string,
  endTime: string,
  endsNextDay = false,
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  let minutes = end - start;
  if (endsNextDay || minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatDurationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function isActivityTask(row: Record<string, unknown>): boolean {
  const taskType = String(row.task_type || 'activity');
  return taskType === 'activity';
}

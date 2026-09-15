/**
 * The school week is fixed (Monday-Friday); the school DAY is built from
 * admin-configurable settings (TimetableSettings/TimetableBreak) rather
 * than a hardcoded constant; see TimetableService.getSettings/buildPeriods.
 * Period length is the one thing that isn't admin-configurable: every
 * period is 40 minutes, app-wide.
 */
export interface TimetablePeriod {
  index: number;
  startTime: string; // "08:00", 24h HH:mm
  endTime: string;
}

export interface TimetableDay {
  value: number; // 1=Monday .. 5=Friday, matches TimetableSlot.dayOfWeek
  label: string;
}

export interface TimetableBreakWindow {
  label: string;
  startTime: string;
  endTime: string;
}

export const TIMETABLE_DAYS: TimetableDay[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];

export const PERIOD_DURATION_MINUTES = 40;
export const DEFAULT_DAY_START_TIME = '08:00';
export const DEFAULT_DAY_END_TIME = '14:00';

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

/**
 * Builds the school day as a sequence of PERIOD_DURATION_MINUTES periods
 * from dayStartTime to dayEndTime, treating every admin-configured break
 * window as non-schedulable: a period is never placed across a break, the
 * cursor jumps straight from wherever it is to the break's end (forfeiting
 * a partial fragment if a period would otherwise straddle the break start,
 * same as it forfeits any leftover minutes that don't fill a full period
 * at the end of the day).
 */
export function buildPeriods(dayStartTime: string, dayEndTime: string, breaks: TimetableBreakWindow[]): TimetablePeriod[] {
  const sortedBreaks = [...breaks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const periods: TimetablePeriod[] = [];
  let cursor = dayStartTime;
  let index = 0;
  let guard = 0;
  while (cursor < dayEndTime && guard++ < 200) {
    const covering = sortedBreaks.find((b) => cursor >= b.startTime && cursor < b.endTime);
    if (covering) {
      cursor = covering.endTime;
      continue;
    }
    const next = addMinutes(cursor, PERIOD_DURATION_MINUTES);
    const upcoming = sortedBreaks.find((b) => b.startTime > cursor && b.startTime < next);
    if (upcoming) {
      cursor = upcoming.startTime;
      continue;
    }
    if (next > dayEndTime) break;
    periods.push({ index, startTime: cursor, endTime: next });
    index++;
    cursor = next;
  }
  return periods;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

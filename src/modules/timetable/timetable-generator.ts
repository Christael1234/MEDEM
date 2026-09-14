import { TimetableDay, TimetablePeriod } from './timetable-schedule';

export interface LessonUnit {
  armId: string;
  subjectId: string;
  staffProfileId: string;
}

export interface PlacedLesson extends LessonUnit {
  dayOfWeek: number;
  periodIndex: number;
}

export interface ArmGenerationOutcome {
  armId: string;
  placed: PlacedLesson[];
  unplacedCount: number;
}

/** day (1-5) * 1000 + period — collision-free as long as no arm's day has
 * 1000+ periods (a 30-minute-period school day would need to run for over
 * 8 days straight to hit that). Used for O(1) teacher-availability checks. */
function slotKey(day: number, period: number): number {
  return day * 1000 + period;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Distributes `slotsPerWeek` evenly across the given subjects (as periods
 * per week), so the arm's grid ends up completely filled with no idle
 * periods. Remainder periods (slotsPerWeek % subjectCount) go one each to
 * the first subjects in the (stable, sorted) list — deterministic rather
 * than random, so re-generating doesn't reshuffle who gets the extra period.
 * `slotsPerWeek` is caller-computed per class (see TimetableService.generate)
 * rather than a single tenant-wide constant, since a Nursery class's day is
 * sized to its own (small) subject count, not the full Junior/Senior day.
 */
export function distributePeriodsPerWeek<T extends { subjectId: string }>(
  assignments: T[],
  slotsPerWeek: number,
): (T & { periodsPerWeek: number })[] {
  const sorted = [...assignments].sort((a, b) => a.subjectId.localeCompare(b.subjectId));
  const base = Math.floor(slotsPerWeek / sorted.length);
  const remainder = slotsPerWeek % sorted.length;
  return sorted.map((a, i) => ({ ...a, periodsPerWeek: base + (i < remainder ? 1 : 0) }));
}

/**
 * Places every lesson unit for one class arm into its week's cells,
 * respecting two hard constraints (mirrored by TimetableSlot's two @@unique
 * indexes): the arm sees exactly one subject per cell, and a teacher
 * already booked elsewhere (tracked in the shared `teacherOccupancy` map,
 * which accumulates across arms as generation proceeds) can't be booked
 * again in the same cell. Same-subject-same-day is a soft preference only
 * (cell ordering), since a subject needing more than 5 periods/week simply
 * can't avoid repeating a day.
 *
 * `periods` is this arm's own period list — a Nursery arm gets only the
 * first N periods of the tenant's full day (N = its subject count), every
 * other arm gets the full day — so `cells` is built per-arm, not once
 * globally.
 *
 * Backtracking DFS with a step budget: if the budget is exhausted before a
 * full placement is found, every unit for this arm is reported unplaced
 * (nothing partial is committed) rather than risking an inconsistent
 * half-solution — the caller decides how to surface that as a conflict.
 */
function scheduleArm(
  armId: string,
  unitsForArm: { subjectId: string; staffProfileId: string }[],
  teacherOccupancy: Map<string, Set<number>>,
  rng: () => number,
  periods: TimetablePeriod[],
  days: TimetableDay[],
): ArmGenerationOutcome {
  const slotsForArm = periods.length * days.length;
  const cells = shuffle(
    days.flatMap((d) => periods.map((p) => ({ day: d.value, period: p.index }))),
    rng,
  );
  const units = shuffle([...unitsForArm], rng).sort((a, b) => {
    const freeA = slotsForArm - (teacherOccupancy.get(a.staffProfileId)?.size ?? 0);
    const freeB = slotsForArm - (teacherOccupancy.get(b.staffProfileId)?.size ?? 0);
    return freeA - freeB; // most-constrained (fewest free slots) teacher first
  });

  const usedCell = new Array(cells.length).fill(false);
  const subjectDaysUsed = new Map<string, Set<number>>();
  const assignment: PlacedLesson[] = new Array(units.length);

  let steps = 0;
  const MAX_STEPS = 30000;

  function candidateOrder(subjectId: string): number[] {
    const free: number[] = [];
    for (let i = 0; i < cells.length; i++) if (!usedCell[i]) free.push(i);
    const daysUsed = subjectDaysUsed.get(subjectId);
    const preferred = free.filter((i) => !daysUsed?.has(cells[i].day));
    const fallback = free.filter((i) => daysUsed?.has(cells[i].day));
    return [...preferred, ...fallback];
  }

  function backtrack(unitIdx: number): boolean {
    if (unitIdx >= units.length) return true;
    if (++steps > MAX_STEPS) return false;

    const unit = units[unitIdx];
    for (const cellIdx of candidateOrder(unit.subjectId)) {
      const cell = cells[cellIdx];
      const key = slotKey(cell.day, cell.period);
      const teacherSet = teacherOccupancy.get(unit.staffProfileId) ?? new Set<number>();
      if (teacherSet.has(key)) continue;

      usedCell[cellIdx] = true;
      teacherSet.add(key);
      teacherOccupancy.set(unit.staffProfileId, teacherSet);
      const daysSet = subjectDaysUsed.get(unit.subjectId) ?? new Set<number>();
      const dayWasNew = !daysSet.has(cell.day);
      daysSet.add(cell.day);
      subjectDaysUsed.set(unit.subjectId, daysSet);
      assignment[unitIdx] = { armId, subjectId: unit.subjectId, staffProfileId: unit.staffProfileId, dayOfWeek: cell.day, periodIndex: cell.period };

      if (backtrack(unitIdx + 1)) return true;

      usedCell[cellIdx] = false;
      teacherSet.delete(key);
      if (dayWasNew) daysSet.delete(cell.day);
    }
    return false;
  }

  const ok = backtrack(0);
  return ok
    ? { armId, placed: assignment, unplacedCount: 0 }
    : { armId, placed: [], unplacedCount: units.length };
}

/**
 * Schedules every arm's lesson units, sharing one teacher-occupancy map
 * across arms so a teacher assigned to the same subject in two arms of the
 * same class (a single TeacherSubjectAssignment covers every arm of its
 * SchoolClass) never ends up double-booked between them — and so a teacher
 * split between, say, a Nursery arm and a JSS arm is checked against the
 * same tenant-wide period-index/clock-time mapping either way.
 */
export function scheduleAllArms(
  unitsByArm: Map<string, { subjectId: string; staffProfileId: string }[]>,
  periodsByArm: Map<string, TimetablePeriod[]>,
  days: TimetableDay[],
  seed = Date.now(),
): ArmGenerationOutcome[] {
  let s = seed;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const armIds = shuffle([...unitsByArm.keys()], rng);
  const teacherOccupancy = new Map<string, Set<number>>();
  return armIds.map((armId) => scheduleArm(armId, unitsByArm.get(armId)!, teacherOccupancy, rng, periodsByArm.get(armId)!, days));
}

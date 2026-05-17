import { DAY_INDEX, UserWorkoutSchedule } from "@lifting-logbook/types";
import { addDaysLocal } from "@src/core/utils/jsUtil";

export interface DistributedWeek {
  week: number;
  workouts: Date[];
}

// Backs a date up to the Monday of its week. Uses local time to match addDaysLocal.
// JS Date.getDay() returns 0=Sun … 6=Sat; the project encodes 0=Mon … 6=Sun via DAY_INDEX.
// (jsDay + 6) % 7 converts: Sun(0)→6, Mon(1)→0, Tue(2)→1, …
function alignToMonday(date: Date): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offsetFromMonday = (base.getDay() + 6) % 7;
  return addDaysLocal(base, -offsetFromMonday);
}

function getWeekPattern(
  schedule: UserWorkoutSchedule,
  weekIndex: number,
): number[] {
  if (schedule.type === "fixed") return schedule.days ?? [];
  const weeks = schedule.weeks ?? [];
  if (weeks.length === 0) return [];
  return weeks[weekIndex % weeks.length] ?? [];
}

/**
 * Distributes a fixed number of workouts across weeks according to a user schedule.
 *
 * The first week is aligned to the Monday of `cycleStartDate`'s week; days earlier in
 * that week than the start date are still emitted, matching the design-doc contract
 * (callers wanting "future days only" should filter the first week themselves).
 *
 * Returns an empty array when the schedule has no usable days (e.g. an empty fixed
 * `days` array or rotating with all-empty weeks) — guards against infinite loops.
 */
export function distributeWorkouts(
  cycleWorkouts: number,
  schedule: UserWorkoutSchedule,
  cycleStartDate: Date,
): DistributedWeek[] {
  if (cycleWorkouts <= 0) return [];

  // Guard against schedules with no placeable days — without this, the while loop
  // below would spin forever advancing weekCounter without placing anything.
  const hasAnyDays =
    schedule.type === "fixed"
      ? (schedule.days?.length ?? 0) > 0
      : (schedule.weeks ?? []).some((w) => w.length > 0);
  if (!hasAnyDays) return [];

  const distribution: DistributedWeek[] = [];
  let workoutsPlaced = 0;
  let weekCounter = 0;
  let currentWeekStart = alignToMonday(cycleStartDate);

  while (workoutsPlaced < cycleWorkouts) {
    const weekPattern = getWeekPattern(schedule, weekCounter);
    const weekWorkouts: Date[] = [];

    for (const dayIndex of weekPattern) {
      if (workoutsPlaced >= cycleWorkouts) break;
      weekWorkouts.push(addDaysLocal(currentWeekStart, dayIndex));
      workoutsPlaced++;
    }

    if (weekWorkouts.length > 0) {
      distribution.push({ week: weekCounter + 1, workouts: weekWorkouts });
    }

    currentWeekStart = addDaysLocal(currentWeekStart, 7);
    weekCounter++;
  }

  return distribution;
}

/**
 * Estimated workouts per week for a schedule. Used only for cycle-duration display —
 * the schedule itself drives distribution, not this number.
 *
 * Fixed → number of training days. Rotating → rounded average across week patterns.
 */
export function getScheduleWorkoutsPerWeek(
  schedule: UserWorkoutSchedule,
): number {
  if (schedule.type === "fixed") return (schedule.days ?? []).length;
  const weeks = schedule.weeks ?? [];
  if (weeks.length === 0) return 0;
  const total = weeks.reduce((sum, w) => sum + w.length, 0);
  return Math.round(total / weeks.length);
}

// Re-export so callers writing day-of-week math have the convention in scope.
export { DAY_INDEX };

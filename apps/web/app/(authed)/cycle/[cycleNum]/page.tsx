import { notFound } from 'next/navigation';
import {
  fetchCycleDashboard,
  fetchProgramSpec,
  fetchTrainingMaxes,
  fetchWorkout,
} from '@/lib/api';
import { getActiveProgram } from '@/lib/active-program';
import { getPreferredUnit } from '@/lib/preferences';
import {
  buildWorkoutDays,
  computePlannedSets,
  type WeekRow,
  type WorkoutCell,
} from '@/lib/workoutPlan';
import CycleDashboardGrid from './CycleDashboardGrid';

export default async function CycleDashboardPage({
  params,
}: {
  params: Promise<{ cycleNum: string }>;
}) {
  const { cycleNum: cycleNumParam } = await params;
  const requestedCycleNum = Number(cycleNumParam);
  const program = await getActiveProgram();

  const [dashboard, specs, maxes, unit] = await Promise.all([
    fetchCycleDashboard(program),
    fetchProgramSpec(program),
    fetchTrainingMaxes(program),
    getPreferredUnit(),
  ]);

  if (!dashboard || dashboard.cycleNum !== requestedCycleNum) {
    notFound();
  }

  const workoutDays = buildWorkoutDays(specs, dashboard.cycleStartDate);
  const workoutResponseList = await Promise.all(
    workoutDays.map((w) => fetchWorkout(program, w.workoutNum)),
  );
  const workoutResponseMap = new Map(
    workoutDays.map((w, i) => [w.workoutNum, workoutResponseList[i]]),
  );

  // Build a flat workoutNum → scheduled date lookup from the cycle dashboard response.
  // This is populated when schedule mode is active; empty when no schedule is set.
  const scheduledDateMap = new Map<number, string>();
  const skippedWorkoutNums = new Set<number>();
  for (const week of dashboard.weeks) {
    for (const ws of week.workouts) {
      scheduledDateMap.set(ws.workoutNum, ws.date);
      if (ws.skipped) skippedWorkoutNums.add(ws.workoutNum);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const maxMap = new Map(maxes.map((m) => [m.lift, m.weight]));

  const weekNums = [...new Set(workoutDays.map((w) => w.week))];

  const weeks: WeekRow[] = weekNums.map((week) => ({
    week,
    workouts: workoutDays
      .filter((w) => w.week === week)
      .map((w): WorkoutCell => {
        const response = workoutResponseMap.get(w.workoutNum);
        const logged = response != null && response.lifts.some((l) => !l.planned);
        // Priority: user override date > API scheduled date > spec-computed date.
        const effectiveDate = response?.overrideDate ?? scheduledDateMap.get(w.workoutNum) ?? w.date;
        const status: WorkoutCell['status'] = logged
          ? 'completed'
          : skippedWorkoutNums.has(w.workoutNum)
            ? 'skipped'
            : effectiveDate < today
              ? 'missed'
              : 'upcoming';
        return {
          workoutNum: w.workoutNum,
          date: effectiveDate,
          status,
          lifts: w.lifts.map((spec) => ({
            name: spec.lift,
            sets: computePlannedSets(spec, maxMap.get(spec.lift) ?? 0),
          })),
        };
      }),
  }));

  return <CycleDashboardGrid cycleNum={dashboard.cycleNum} weeks={weeks} unit={unit} />;
}

import { notFound } from 'next/navigation';
import {
  fetchCycleDashboard,
  fetchProgramSpec,
  fetchTrainingMaxes,
  fetchWorkout,
} from '@/lib/api';
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
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '531';

  const [dashboard, specs, maxes] = await Promise.all([
    fetchCycleDashboard(program),
    fetchProgramSpec(program),
    fetchTrainingMaxes(program),
  ]);

  if (dashboard.cycleNum !== requestedCycleNum) {
    notFound();
  }

  const workoutDays = buildWorkoutDays(specs, dashboard.cycleStartDate);
  const workoutResponseList = await Promise.all(
    workoutDays.map((w) => fetchWorkout(program, w.workoutNum)),
  );
  const workoutResponseMap = new Map(
    workoutDays.map((w, i) => [w.workoutNum, workoutResponseList[i]]),
  );

  const today = new Date().toISOString().slice(0, 10);
  const maxMap = new Map(maxes.map((m) => [m.lift, m.weight]));

  // Derive week numbers from workout offsets. Assumes 2 workouts per week —
  // a workouts-per-week value from the program config would generalize this.
  const weekNums = [...new Set(workoutDays.map((w) => Math.ceil(w.workoutNum / 2)))];

  const weeks: WeekRow[] = weekNums.map((week) => ({
    week,
    workouts: workoutDays
      .filter((w) => Math.ceil(w.workoutNum / 2) === week)
      .map((w): WorkoutCell => {
        const response = workoutResponseMap.get(w.workoutNum);
        const logged = response != null && response.lifts.length > 0;
        const status: WorkoutCell['status'] = logged
          ? 'completed'
          : w.date < today
            ? 'missed'
            : 'upcoming';
        return {
          workoutNum: w.workoutNum,
          date: w.date,
          status,
          lifts: w.lifts.map((spec) => ({
            name: spec.lift,
            sets: computePlannedSets(spec, maxMap.get(spec.lift) ?? 0),
          })),
        };
      }),
  }));

  return <CycleDashboardGrid cycleNum={dashboard.cycleNum} weeks={weeks} />;
}

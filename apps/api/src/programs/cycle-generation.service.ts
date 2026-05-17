import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { UserWorkoutSchedule } from '@lifting-logbook/types';
import {
  CycleDashboard,
  LiftingProgramSpec,
  distributeWorkouts,
  formatDateYYYYMMDD,
  getScheduleWorkoutsPerWeek,
  MaxReductionFlag,
  TrainingMax,
  TrainingMaxHistoryEntry,
  updateCycle,
  updateMaxes,
  WEEKDAY_MAP,
  Weekday,
} from '@lifting-logbook/core';
import { RepositoryBundle } from '../ports';
import { ScheduledWorkout } from '../ports/ICycleScheduledWorkoutRepository';
import { ProgramNotFoundError } from '../ports/errors';
import { StartNewCycleDto } from './start-new-cycle.dto';

type CycleRepos = Pick<
  RepositoryBundle,
  | 'cycleDashboard'
  | 'cycleScheduledWorkout'
  | 'liftingProgramSpec'
  | 'liftRecord'
  | 'trainingMax'
  | 'trainingMaxHistory'
  | 'userSettings'
>;

/**
 * Static metadata required to bootstrap cycle 1 for each supported program.
 * ADD AN ENTRY HERE when a new program is made available in onboarding —
 * omitting it causes 400 Bad Request for every first-time user of that program.
 */
const PROGRAM_DEFAULTS: Record<string, { cycleUnit: string; programType: string }> = {
  '5-3-1': { cycleUnit: 'week', programType: '5-3-1' },
  'rpt': { cycleUnit: 'week', programType: 'rpt' },
  'starting-strength': { cycleUnit: 'week', programType: 'starting-strength' },
  'stronglifts': { cycleUnit: 'week', programType: 'stronglifts' },
  'ppl': { cycleUnit: 'week', programType: 'ppl' },
  'upper-lower': { cycleUnit: 'week', programType: 'upper-lower' },
  '531': { cycleUnit: 'week', programType: '531' },
  '531-bbb': { cycleUnit: 'week', programType: '531-bbb' },
  '531-forever': { cycleUnit: 'week', programType: '531-forever' },
  'leangains': { cycleUnit: 'week', programType: 'leangains' },
  'conjugate': { cycleUnit: 'week', programType: 'conjugate' },
  'smolov': { cycleUnit: 'week', programType: 'smolov' },
  'juggernaut': { cycleUnit: 'week', programType: 'juggernaut' },
  'creeping-death-2': { cycleUnit: 'week', programType: 'creeping-death-2' },
};

async function saveScheduledDates(
  repos: Pick<CycleRepos, 'cycleScheduledWorkout'>,
  program: string,
  cycleNum: number,
  cycleDate: Date,
  programSpec: LiftingProgramSpec[],
  workoutSchedule: UserWorkoutSchedule,
): Promise<void> {
  // numWeeks * workoutsPerWeek assumes schedule days/week equals program
  // workouts/week. Phase 5 adds a user-confirmation prompt that validates
  // this match before schedule mode is activated.
  const numWeeks = Math.max(...programSpec.map((s) => s.week));
  const workoutsPerWeek = getScheduleWorkoutsPerWeek(workoutSchedule);
  const distributed = distributeWorkouts(numWeeks * workoutsPerWeek, workoutSchedule, cycleDate);

  const workouts: ScheduledWorkout[] = [];
  let workoutNum = 1;
  let lastWeek = 0;
  for (const week of distributed) {
    if (week.week <= lastWeek) {
      throw new Error(`distributeWorkouts returned out-of-order week: ${week.week}`);
    }
    lastWeek = week.week;
    for (const date of week.workouts) {
      workouts.push({ workoutNum, weekNum: week.week, scheduledDate: date });
      workoutNum++;
    }
  }

  if (workouts.length > 0) {
    await repos.cycleScheduledWorkout.saveScheduledWorkouts(program, cycleNum, workouts);
  }
}

function round1dp(w: number): number {
  return Math.round(w * 10) / 10;
}

function buildHistoryEntries(
  prevMaxes: TrainingMax[],
  newMaxes: TrainingMax[],
  date: Date,
  source: 'test' | 'program',
): Omit<TrainingMaxHistoryEntry, 'id'>[] {
  const prevMap = new Map(prevMaxes.map((m) => [m.lift, round1dp(m.weight)]));
  return newMaxes
    .filter((m) => prevMap.get(m.lift) !== round1dp(m.weight))
    .map((m) => ({
      lift: m.lift,
      weight: m.weight,
      reps: 1,
      date,
      isPR: false,
      source,
      goalMet: false,
    }));
}

@Injectable()
export class CycleGenerationService {
  async startNewCycle(
    repos: CycleRepos,
    program: string,
    dto: StartNewCycleDto = {},
  ): Promise<CycleDashboard> {
    const dashboard = await repos.cycleDashboard.getCycleDashboard(program);
    const sourceCycleNum = dto.fromCycleNum ?? dashboard.cycleNum;

    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      repos.liftingProgramSpec.getProgramSpec(program),
      repos.trainingMax.getTrainingMaxes(program),
      repos.liftRecord.getLiftRecords(program, sourceCycleNum),
    ]);

    let prevDashboard = dashboard;
    if (dto.fromCycleNum !== undefined) {
      if (liftRecords.length === 0) {
        throw new BadRequestException(
          `No lift records found for cycle ${dto.fromCycleNum}`,
        );
      }
      const minDate = liftRecords.reduce(
        (min, r) => (r.date < min ? r.date : min),
        liftRecords[0]!.date,
      );
      prevDashboard = { ...dashboard, cycleNum: dto.fromCycleNum, cycleDate: minDate };
    }

    const cycleOverrides = dto.cycleDate
      ? { overrideDate: new Date(dto.cycleDate) }
      : {};

    const newCycle = updateCycle(prevDashboard, cycleOverrides);
    // Deliberate: flagged reductions are silently blocked here — they are not surfaced
    // to the caller when advancing a cycle. Use recalculateMaxes to review flagged reductions.
    const { maxes: newMaxes } = updateMaxes(programSpec, trainingMaxes, liftRecords);

    // Write order: maxes → scheduled dates → dashboard. If dashboard write fails,
    // cycleNum hasn't advanced in the dashboard so a retry is safe. Scheduled date
    // rows use replace-all semantics and are idempotent across retries.
    await repos.trainingMax.saveTrainingMaxes(program, newMaxes);
    const settings = await repos.userSettings.getSettings();
    if (settings.workoutSchedule) {
      await saveScheduledDates(repos, program, newCycle.cycleNum, newCycle.cycleDate, programSpec, settings.workoutSchedule);
    }
    await repos.cycleDashboard.saveCycleDashboard(newCycle);

    const source = dashboard.currentWeekType === 'test' ? 'test' : 'program';
    const historyEntries = buildHistoryEntries(trainingMaxes, newMaxes, newCycle.cycleDate, source);
    if (historyEntries.length > 0) {
      await repos.trainingMaxHistory.appendHistoryEntries(program, historyEntries);
    }

    return newCycle;
  }

  async initializeFirstCycle(
    repos: Pick<CycleRepos, 'cycleDashboard' | 'cycleScheduledWorkout' | 'liftingProgramSpec' | 'userSettings'>,
    program: string,
    dto: { cycleDate?: string } = {},
  ): Promise<CycleDashboard> {
    // Guard: fail fast if a cycle already exists for this user+program
    try {
      await repos.cycleDashboard.getCycleDashboard(program);
      throw new ConflictException(`A cycle for "${program}" already exists.`);
    } catch (e) {
      if (!(e instanceof ProgramNotFoundError)) throw e;
      // ProgramNotFoundError is expected — no cycle exists yet, proceed
    }

    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const defaults = PROGRAM_DEFAULTS[program] ??
      (UUID_PATTERN.test(program) ? { cycleUnit: 'week', programType: 'custom' } : null);
    if (!defaults) {
      throw new BadRequestException(`Unknown program: "${program}"`);
    }

    const cycleDate = dto.cycleDate ? new Date(dto.cycleDate) : new Date();
    // Search enum values (PascalCase) rather than WEEKDAY_MAP keys (lowercase)
    // to ensure the stored value matches the Weekday enum contract.
    const weekdayName = Object.values(Weekday).find(
      (v) => WEEKDAY_MAP[v.toLowerCase()] === cycleDate.getUTCDay(),
    );
    if (!weekdayName) {
      throw new Error(`No Weekday mapping for UTC day index ${cycleDate.getUTCDay()}`);
    }

    const dashboard: CycleDashboard = {
      program,
      cycleUnit: defaults.cycleUnit,
      cycleNum: 1,
      cycleDate,
      sheetName: `${program}_Cycle_1_${formatDateYYYYMMDD(cycleDate)}`,
      cycleStartWeekday: weekdayName,
      currentWeekType: 'training',
      programType: defaults.programType,
    };

    const settings = await repos.userSettings.getSettings();
    if (settings.workoutSchedule) {
      const spec = await repos.liftingProgramSpec.getProgramSpec(program);
      await saveScheduledDates(repos, program, dashboard.cycleNum, dashboard.cycleDate, spec, settings.workoutSchedule);
    }
    await repos.cycleDashboard.saveCycleDashboard(dashboard);
    return dashboard;
  }

  async recalculateMaxes(
    repos: CycleRepos,
    program: string,
  ): Promise<{ maxes: TrainingMax[]; flagged: MaxReductionFlag[] }> {
    const dashboard = await repos.cycleDashboard.getCycleDashboard(program);
    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      repos.liftingProgramSpec.getProgramSpec(program),
      repos.trainingMax.getTrainingMaxes(program),
      repos.liftRecord.getLiftRecords(program, dashboard.cycleNum),
    ]);

    const result = updateMaxes(programSpec, trainingMaxes, liftRecords);
    await repos.trainingMax.saveTrainingMaxes(program, result.maxes);

    const historyEntries = buildHistoryEntries(trainingMaxes, result.maxes, dashboard.cycleDate, 'program');
    if (historyEntries.length > 0) {
      await repos.trainingMaxHistory.appendHistoryEntries(program, historyEntries);
    }

    return result;
  }
}

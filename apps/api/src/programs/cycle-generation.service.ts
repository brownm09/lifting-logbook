import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  CycleDashboard,
  formatDateYYYYMMDD,
  MaxReductionFlag,
  TrainingMax,
  TrainingMaxHistoryEntry,
  updateCycle,
  updateMaxes,
  WEEKDAY_MAP,
  Weekday,
} from '@lifting-logbook/core';
import { RepositoryBundle } from '../ports';
import { ProgramNotFoundError } from '../ports/errors';
import { StartNewCycleDto } from './start-new-cycle.dto';

type CycleRepos = Pick<
  RepositoryBundle,
  'cycleDashboard' | 'liftingProgramSpec' | 'trainingMax' | 'trainingMaxHistory' | 'liftRecord'
>;

/**
 * Static metadata required to bootstrap cycle 1 for each supported program.
 * ADD AN ENTRY HERE when a new program is made available in onboarding —
 * omitting it causes 400 Bad Request for every first-time user of that program.
 */
const PROGRAM_DEFAULTS: Record<string, { cycleUnit: string; programType: string }> = {
  '5-3-1': { cycleUnit: 'week', programType: '5-3-1' },
};

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

    // Write order: maxes before dashboard — if dashboard write fails, cycle counter
    // hasn't advanced and a retry is safe. True atomicity requires a transaction.
    await repos.trainingMax.saveTrainingMaxes(program, newMaxes);
    await repos.cycleDashboard.saveCycleDashboard(newCycle);

    const source = dashboard.currentWeekType === 'test' ? 'test' : 'program';
    const historyEntries = buildHistoryEntries(trainingMaxes, newMaxes, newCycle.cycleDate, source);
    if (historyEntries.length > 0) {
      await repos.trainingMaxHistory.appendHistoryEntries(program, historyEntries);
    }

    return newCycle;
  }

  async initializeFirstCycle(
    repos: Pick<CycleRepos, 'cycleDashboard'>,
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

    const defaults = PROGRAM_DEFAULTS[program];
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

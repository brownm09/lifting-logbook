import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CycleDashboard,
  MaxReductionFlag,
  TrainingMax,
  TrainingMaxHistoryEntry,
  updateCycle,
  updateMaxes,
} from '@lifting-logbook/core';
import { RepositoryBundle } from '../ports';
import { StartNewCycleDto } from './start-new-cycle.dto';

type CycleRepos = Pick<
  RepositoryBundle,
  'cycleDashboard' | 'liftingProgramSpec' | 'trainingMax' | 'trainingMaxHistory' | 'liftRecord'
>;

function buildHistoryEntries(
  prevMaxes: TrainingMax[],
  newMaxes: TrainingMax[],
  date: Date,
  source: 'test' | 'program',
): Omit<TrainingMaxHistoryEntry, 'id'>[] {
  const prevMap = new Map(prevMaxes.map((m) => [m.lift, m.weight]));
  return newMaxes
    .filter((m) => prevMap.get(m.lift) !== m.weight)
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

    const historyEntries = buildHistoryEntries(trainingMaxes, result.maxes, new Date(), 'program');
    if (historyEntries.length > 0) {
      await repos.trainingMaxHistory.appendHistoryEntries(program, historyEntries);
    }

    return result;
  }
}

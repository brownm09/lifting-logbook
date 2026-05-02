import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CycleDashboard,
  TrainingMax,
  updateCycle,
  updateMaxes,
} from '@lifting-logbook/core';
import { RepositoryBundle } from '../ports';
import { StartNewCycleDto } from './start-new-cycle.dto';

type CycleRepos = Pick<
  RepositoryBundle,
  'cycleDashboard' | 'liftingProgramSpec' | 'trainingMax' | 'liftRecord'
>;

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
    const newMaxes = updateMaxes(programSpec, trainingMaxes, liftRecords);

    // Write order: maxes before dashboard — if dashboard write fails, cycle counter
    // hasn't advanced and a retry is safe. True atomicity requires a transaction.
    await repos.trainingMax.saveTrainingMaxes(program, newMaxes);
    await repos.cycleDashboard.saveCycleDashboard(newCycle);

    return newCycle;
  }

  async recalculateMaxes(repos: CycleRepos, program: string): Promise<TrainingMax[]> {
    const dashboard = await repos.cycleDashboard.getCycleDashboard(program);
    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      repos.liftingProgramSpec.getProgramSpec(program),
      repos.trainingMax.getTrainingMaxes(program),
      repos.liftRecord.getLiftRecords(program, dashboard.cycleNum),
    ]);

    const newMaxes = updateMaxes(programSpec, trainingMaxes, liftRecords);
    await repos.trainingMax.saveTrainingMaxes(program, newMaxes);

    return newMaxes;
  }
}

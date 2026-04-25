import { Inject, Injectable } from '@nestjs/common';
import {
  CycleDashboard,
  TrainingMax,
  updateCycle,
  updateMaxes,
} from '@lifting-logbook/core';
import {
  ICycleDashboardRepository,
  ILiftRecordRepository,
  ILiftingProgramSpecRepository,
  ITrainingMaxRepository,
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  TRAINING_MAX_REPOSITORY,
} from '../ports';

@Injectable()
export class CycleGenerationService {
  constructor(
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
    @Inject(LIFTING_PROGRAM_SPEC_REPOSITORY)
    private readonly programSpecRepo: ILiftingProgramSpecRepository,
    @Inject(TRAINING_MAX_REPOSITORY)
    private readonly trainingMaxRepo: ITrainingMaxRepository,
    @Inject(LIFT_RECORD_REPOSITORY)
    private readonly liftRecordRepo: ILiftRecordRepository,
  ) {}

  /**
   * Advances the current cycle: computes the next cycle header, updates
   * training maxes from the current cycle's lift records, and persists both.
   * Returns the new `CycleDashboard`.
   */
  async startNewCycle(program: string): Promise<CycleDashboard> {
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      this.programSpecRepo.getProgramSpec(program),
      this.trainingMaxRepo.getTrainingMaxes(program),
      this.liftRecordRepo.getLiftRecords(program, dashboard.cycleNum),
    ]);

    const newCycle = updateCycle(dashboard);
    const newMaxes = updateMaxes(programSpec, trainingMaxes, liftRecords);

    await Promise.all([
      this.cycleDashboardRepo.saveCycleDashboard(newCycle),
      this.trainingMaxRepo.saveTrainingMaxes(program, newMaxes),
    ]);

    return newCycle;
  }

  /**
   * Re-runs training max calculation against the current cycle's lift records
   * without advancing the cycle. Persists and returns the updated maxes.
   */
  async recalculateMaxes(program: string): Promise<TrainingMax[]> {
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      this.programSpecRepo.getProgramSpec(program),
      this.trainingMaxRepo.getTrainingMaxes(program),
      this.liftRecordRepo.getLiftRecords(program, dashboard.cycleNum),
    ]);

    const newMaxes = updateMaxes(programSpec, trainingMaxes, liftRecords);
    await this.trainingMaxRepo.saveTrainingMaxes(program, newMaxes);

    return newMaxes;
  }
}

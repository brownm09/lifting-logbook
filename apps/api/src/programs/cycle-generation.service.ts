import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
import { StartNewCycleDto } from './start-new-cycle.dto';

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
   * training maxes from the source cycle's lift records, and persists both.
   *
   * When `dto.fromCycleNum` is provided the endpoint advances *from that
   * cycle* (cycleNum becomes fromCycleNum + 1) and uses its records for max
   * calculation; the anchor date is min(record.date) for that cycle.
   * When `dto.cycleDate` is provided the new cycle's start date is pinned to
   * that ISO string rather than being computed from the previous date.
   *
   * Write order: maxes are saved before the dashboard so that if the second
   * write fails the cycle counter has not yet advanced and a retry is safe.
   * True atomicity requires a transaction primitive — add when real adapters land.
   */
  async startNewCycle(
    program: string,
    dto: StartNewCycleDto = {},
  ): Promise<CycleDashboard> {
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    const sourceCycleNum = dto.fromCycleNum ?? dashboard.cycleNum;

    const [programSpec, trainingMaxes, liftRecords] = await Promise.all([
      this.programSpecRepo.getProgramSpec(program),
      this.trainingMaxRepo.getTrainingMaxes(program),
      this.liftRecordRepo.getLiftRecords(program, sourceCycleNum),
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

    await this.trainingMaxRepo.saveTrainingMaxes(program, newMaxes);
    await this.cycleDashboardRepo.saveCycleDashboard(newCycle);

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

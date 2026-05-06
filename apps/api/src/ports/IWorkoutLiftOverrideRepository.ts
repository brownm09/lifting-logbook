import { LiftOverrideAction } from '@lifting-logbook/types';

export interface LiftOverride {
  lift: string;
  action: LiftOverrideAction;
  replacedBy?: string;
}

export interface IWorkoutLiftOverrideRepository {
  getOverrides(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftOverride[]>;

  upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    override: LiftOverride,
  ): Promise<void>;

  deleteOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    lift: string,
  ): Promise<void>;
}

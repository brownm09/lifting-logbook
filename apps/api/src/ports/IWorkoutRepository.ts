import { LiftRecord } from '@lifting-logbook/core';

export interface IWorkoutRepository {
  getWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftRecord[]>;

  saveWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
    records: LiftRecord[],
  ): Promise<void>;
}

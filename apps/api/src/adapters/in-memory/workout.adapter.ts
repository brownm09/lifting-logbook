import { LiftRecord } from '@lifting-logbook/core';
import { IWorkoutRepository } from '../../ports/IWorkoutRepository';
import { WorkoutNotFoundError } from '../../ports/errors';
import { SEED_PROGRAM, seedLiftRecords } from './fixtures';

const workoutKey = (program: string, cycleNum: number, workoutNum: number) =>
  `${program}::${cycleNum}::${workoutNum}`;

export class InMemoryWorkoutRepository implements IWorkoutRepository {
  private workouts: Map<string, LiftRecord[]>;

  constructor(preSeed = false) {
    this.workouts = new Map();
    if (preSeed) {
      this.workouts.set(workoutKey(SEED_PROGRAM, 1, 1), seedLiftRecords());
    }
  }

  async getWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftRecord[]> {
    const records = this.workouts.get(workoutKey(program, cycleNum, workoutNum));
    if (!records) {
      throw new WorkoutNotFoundError(program, cycleNum, workoutNum);
    }
    return records;
  }

  async saveWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
    records: LiftRecord[],
  ): Promise<void> {
    this.workouts.set(workoutKey(program, cycleNum, workoutNum), records);
  }
}

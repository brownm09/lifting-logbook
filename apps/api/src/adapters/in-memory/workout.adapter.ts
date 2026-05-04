import { LiftRecord } from '@lifting-logbook/core';
import { IWorkoutRepository } from '../../ports/IWorkoutRepository';
import { WorkoutNotFoundError } from '../../ports/errors';

export class InMemoryWorkoutRepository implements IWorkoutRepository {
  constructor(private readonly store: Map<string, LiftRecord[]>) {}

  async getWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftRecord[]> {
    const records = (this.store.get(program) ?? []).filter(
      (r) => r.cycleNum === cycleNum && r.workoutNum === workoutNum,
    );
    if (records.length === 0) {
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
    const existing = this.store.get(program) ?? [];
    const kept = existing.filter(
      (r) => !(r.cycleNum === cycleNum && r.workoutNum === workoutNum),
    );
    this.store.set(program, [...kept, ...records]);
  }
}

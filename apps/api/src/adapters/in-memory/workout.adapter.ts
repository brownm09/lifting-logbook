import { Injectable, NotFoundException } from '@nestjs/common';
import { LiftRecord } from '@lifting-logbook/core';
import { IWorkoutRepository } from '../../ports/IWorkoutRepository';
import { SEED_PROGRAM, seedLiftRecords } from './fixtures';

const workoutKey = (program: string, cycleNum: number, workoutNum: number) =>
  `${program}::${cycleNum}::${workoutNum}`;

@Injectable()
export class InMemoryWorkoutRepository implements IWorkoutRepository {
  private workouts = new Map<string, LiftRecord[]>();

  constructor() {
    const seed = seedLiftRecords();
    this.workouts.set(workoutKey(SEED_PROGRAM, 1, 1), seed);
  }

  async getWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftRecord[]> {
    const records = this.workouts.get(workoutKey(program, cycleNum, workoutNum));
    if (!records) {
      throw new NotFoundException(
        `Workout ${workoutNum} for program '${program}' cycle ${cycleNum} not found`,
      );
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

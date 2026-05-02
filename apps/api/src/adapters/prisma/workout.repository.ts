import { PrismaClient } from '@prisma/client';
import { LiftRecord } from '@lifting-logbook/core';
import { IWorkoutRepository } from '../../ports/IWorkoutRepository';
import { WorkoutNotFoundError } from '../../ports/errors';

export class PrismaWorkoutRepository implements IWorkoutRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getWorkout(program: string, cycleNum: number, workoutNum: number): Promise<LiftRecord[]> {
    const rows = await this.prisma.liftRecord.findMany({
      where: { userId: this.userId, program, cycleNum, workoutNum },
      orderBy: [{ lift: 'asc' }, { setNum: 'asc' }],
    });
    if (rows.length === 0) throw new WorkoutNotFoundError(program, cycleNum, workoutNum);
    return rows.map((r) => ({
      program: r.program,
      cycleNum: r.cycleNum,
      workoutNum: r.workoutNum,
      date: r.date,
      lift: r.lift,
      setNum: r.setNum,
      weight: r.weight,
      reps: r.reps,
      notes: r.notes,
    }));
  }

  async saveWorkout(
    program: string,
    cycleNum: number,
    workoutNum: number,
    records: LiftRecord[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.liftRecord.deleteMany({
        where: { userId: this.userId, program, cycleNum, workoutNum },
      }),
      this.prisma.liftRecord.createMany({
        data: records.map((r) => ({
          userId: this.userId,
          program,
          cycleNum: r.cycleNum,
          workoutNum: r.workoutNum,
          date: r.date,
          lift: r.lift,
          setNum: r.setNum,
          weight: r.weight,
          reps: r.reps,
          notes: r.notes,
        })),
      }),
    ]);
  }
}

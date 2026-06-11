import { PrismaClient } from '@prisma/client';
import { ICycleScheduledWorkoutRepository, ScheduledWorkout } from '../../ports/ICycleScheduledWorkoutRepository';
import { runBatch } from './prisma-tx.util';

export class PrismaCycleScheduledWorkoutRepository implements ICycleScheduledWorkoutRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getScheduledWorkouts(program: string, cycleNum: number): Promise<ScheduledWorkout[]> {
    const rows = await this.prisma.cycleScheduledWorkout.findMany({
      where: { userId: this.userId, program, cycleNum },
      orderBy: { workoutNum: 'asc' },
    });
    return rows.map((r) => ({
      workoutNum: r.workoutNum,
      weekNum: r.weekNum,
      scheduledDate: r.scheduledDate,
    }));
  }

  async saveScheduledWorkouts(program: string, cycleNum: number, workouts: ScheduledWorkout[]): Promise<void> {
    // deleteMany + createMany replaces the full row set for (userId, program, cycleNum).
    // Concurrent cycle creation (e.g., double-submit) can race and hit the unique constraint.
    // Acceptable given cycle creation is a rare, deliberate user action; harden with
    // upsert-per-row semantics if this surfaces in practice.
    await runBatch(this.prisma, (db) => [
      db.cycleScheduledWorkout.deleteMany({
        where: { userId: this.userId, program, cycleNum },
      }),
      db.cycleScheduledWorkout.createMany({
        data: workouts.map((w) => ({
          userId: this.userId,
          program,
          cycleNum,
          workoutNum: w.workoutNum,
          weekNum: w.weekNum,
          scheduledDate: w.scheduledDate,
        })),
      }),
    ]);
  }
}

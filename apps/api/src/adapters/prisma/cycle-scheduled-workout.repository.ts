import { PrismaClient } from '@prisma/client';
import { ICycleScheduledWorkoutRepository, ScheduledWorkout } from '../../ports/ICycleScheduledWorkoutRepository';

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
    await this.prisma.$transaction([
      this.prisma.cycleScheduledWorkout.deleteMany({
        where: { userId: this.userId, program, cycleNum },
      }),
      this.prisma.cycleScheduledWorkout.createMany({
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

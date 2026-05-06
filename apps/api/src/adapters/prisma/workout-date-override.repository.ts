import { PrismaClient } from '@prisma/client';
import { IWorkoutDateOverrideRepository } from '../../ports/IWorkoutDateOverrideRepository';

export class PrismaWorkoutDateOverrideRepository
  implements IWorkoutDateOverrideRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<Date | null> {
    const row = await this.prisma.workoutDateOverride.findUnique({
      where: {
        userId_program_cycleNum_workoutNum: {
          userId: this.userId,
          program,
          cycleNum,
          workoutNum,
        },
      },
    });
    return row?.newDate ?? null;
  }

  async upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    newDate: Date,
  ): Promise<void> {
    await this.prisma.workoutDateOverride.upsert({
      where: {
        userId_program_cycleNum_workoutNum: {
          userId: this.userId,
          program,
          cycleNum,
          workoutNum,
        },
      },
      create: { userId: this.userId, program, cycleNum, workoutNum, newDate },
      update: { newDate },
    });
  }
}

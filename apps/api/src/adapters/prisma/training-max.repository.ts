import { PrismaClient } from '@prisma/client';
import { TrainingMax } from '@lifting-logbook/core';
import { ITrainingMaxRepository } from '../../ports/ITrainingMaxRepository';

export class PrismaTrainingMaxRepository implements ITrainingMaxRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getTrainingMaxes(program: string): Promise<TrainingMax[]> {
    const rows = await this.prisma.trainingMax.findMany({
      where: { userId: this.userId, program },
    });
    return rows.map((r) => ({
      lift: r.lift,
      weight: r.weight,
      dateUpdated: r.dateUpdated,
    }));
  }

  async saveTrainingMaxes(program: string, maxes: TrainingMax[]): Promise<void> {
    await this.prisma.$transaction(
      maxes.map((m) =>
        this.prisma.trainingMax.upsert({
          where: {
            userId_program_lift: { userId: this.userId, program, lift: m.lift },
          },
          create: {
            userId: this.userId,
            program,
            lift: m.lift,
            weight: m.weight,
            dateUpdated: m.dateUpdated,
          },
          update: {
            weight: m.weight,
            dateUpdated: m.dateUpdated,
          },
        }),
      ),
    );
  }
}

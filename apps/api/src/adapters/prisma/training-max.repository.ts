import { PrismaClient } from '@prisma/client';
import { TrainingMax, trainingMaxRowKind } from '@lifting-logbook/core';
import { ImportWriteResult } from '@lifting-logbook/types';
import { ITrainingMaxRepository } from '../../ports/ITrainingMaxRepository';
import { runBatch, runInteractive } from './prisma-tx.util';

export class PrismaTrainingMaxRepository implements ITrainingMaxRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getTrainingMaxes(program: string): Promise<TrainingMax[]> {
    const rows = await this.prisma.trainingMax.findMany({
      where: { userId: this.userId, program },
    });
    // mirrors TrainingMax schema
    return rows.map((r: { lift: string; weight: number; dateUpdated: Date }) => ({
      lift: r.lift,
      weight: r.weight,
      dateUpdated: r.dateUpdated,
    }));
  }

  async saveTrainingMaxes(program: string, maxes: TrainingMax[]): Promise<void> {
    await runBatch(this.prisma, (db) =>
      maxes.map((m) =>
        db.trainingMax.upsert({
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

  async importTrainingMaxes(
    program: string,
    maxes: TrainingMax[],
  ): Promise<ImportWriteResult> {
    // One transaction for the whole batch: the existing read and every upsert
    // share it, so the returned counts reflect exactly what was written and a
    // mid-batch failure rolls the whole import back (issue #488). runInteractive
    // reuses the per-request RLS transaction when present, opens one otherwise.
    return runInteractive(this.prisma, async (tx) => {
      const existing = await tx.trainingMax.findMany({
        where: { userId: this.userId, program },
        select: { lift: true, weight: true },
      });
      const existingByLift = new Map(existing.map((r) => [r.lift, r.weight]));

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const seen = new Set<string>();

      for (const m of maxes) {
        if (seen.has(m.lift)) continue; // collapse duplicate lifts within the file
        seen.add(m.lift);

        const kind = trainingMaxRowKind(m, existingByLift);
        if (kind === 'skip') {
          skipped++;
          continue;
        }

        await tx.trainingMax.upsert({
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
          update: { weight: m.weight, dateUpdated: m.dateUpdated },
        });

        if (kind === 'create') created++;
        else updated++;
      }

      return { created, updated, skipped };
    });
  }
}

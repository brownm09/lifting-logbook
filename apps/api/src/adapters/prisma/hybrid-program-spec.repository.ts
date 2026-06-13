import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LiftingProgramSpec,
  programSpecComparable,
  programSpecNaturalKey,
} from '@lifting-logbook/core';
import {
  ILiftingProgramSpecRepository,
  SaveProgramSpecResult,
} from '../../ports/ILiftingProgramSpecRepository';
import { PrismaClient } from '@prisma/client';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { runInteractive } from './prisma-tx.util';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SpecRow = {
  week: number;
  offset: number;
  lift: string;
  increment: number;
  order: number;
  sets: number;
  reps: number;
  amrap: boolean;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
  weekType: string | null;
};

function toSpec(s: SpecRow): LiftingProgramSpec {
  return {
    week: s.week as 1 | 2 | 3,
    offset: s.offset,
    lift: s.lift,
    increment: s.increment,
    order: s.order,
    sets: s.sets,
    reps: s.reps,
    amrap: s.amrap,
    warmUpPct: s.warmUpPct,
    wtDecrementPct: s.wtDecrementPct,
    activation: s.activation,
    ...(s.weekType !== null && { weekType: s.weekType as 'training' | 'test' | 'deload' }),
  };
}

export class HybridLiftingProgramSpecRepository implements ILiftingProgramSpecRepository {
  // The built-in spec data is user-independent. It defaults to a fresh in-memory
  // repo for standalone construction (tests), but the factory injects a shared
  // instance so the seed map is built once per process rather than per request.
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
    private readonly inMemory: ILiftingProgramSpecRepository = new InMemoryLiftingProgramSpecRepository(),
  ) {}

  async getProgramSpec(program: string): Promise<LiftingProgramSpec[]> {
    if (UUID_PATTERN.test(program)) {
      return this.getCustomSpec(program);
    }
    return this.inMemory.getProgramSpec(program);
  }

  private async getCustomSpec(id: string): Promise<LiftingProgramSpec[]> {
    // Guard on the owning program's userId — a bare where:{ programId } would let
    // any authenticated user read another user's custom program spec by UUID.
    const rows = await this.prisma.customProgramSpec.findMany({
      where: { programId: id, program: { userId: this.userId } },
      orderBy: [{ week: 'asc' }, { order: 'asc' }],
    });
    return rows.map((s) => toSpec(s));
  }

  /**
   * Idempotently writes spec rows for a custom program (see interface docs).
   * Built-in templates are immutable seed data and are rejected.
   *
   * Each row is classified by a find-then-write inside a transaction (so an
   * identical re-import yields `created: 0`). The insert is an `upsert` on the
   * `(programId, week, offset, lift, order)` unique constraint (issue #488) so two
   * concurrent imports racing past the same `findFirst → null` cannot both create
   * a duplicate row — the loser updates instead of hitting a unique violation.
   */
  async saveProgramSpec(
    program: string,
    rows: LiftingProgramSpec[],
  ): Promise<SaveProgramSpecResult> {
    if (!UUID_PATTERN.test(program)) {
      throw new BadRequestException('Program spec import requires a custom program');
    }

    return runInteractive(this.prisma, async (tx) => {
      const owner = await tx.customProgram.findFirst({
        where: { id: program, userId: this.userId },
        select: { id: true },
      });
      if (!owner) throw new NotFoundException(`Custom program ${program} not found`);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const seen = new Set<string>();

      for (const r of rows) {
        const key = programSpecNaturalKey(r);
        if (seen.has(key)) continue; // collapse duplicate keys within the file
        seen.add(key);

        const data = {
          programId: program,
          week: r.week,
          offset: r.offset,
          lift: r.lift,
          increment: r.increment,
          order: r.order,
          sets: r.sets,
          reps: r.reps,
          amrap: r.amrap === true || r.amrap === 'TRUE',
          warmUpPct: r.warmUpPct,
          wtDecrementPct: r.wtDecrementPct,
          activation: r.activation,
          weekType: r.weekType ?? null,
        };

        const existing = await tx.customProgramSpec.findFirst({
          where: {
            programId: program,
            week: r.week,
            offset: r.offset,
            lift: r.lift,
            order: r.order,
          },
        });

        if (!existing) {
          // upsert (not create) on the natural-key constraint: a concurrent import
          // that created this row after our findFirst makes the loser update, not
          // throw P2002 (issue #488).
          await tx.customProgramSpec.upsert({
            where: {
              programId_week_offset_lift_order: {
                programId: program,
                week: r.week,
                offset: r.offset,
                lift: r.lift,
                order: r.order,
              },
            },
            create: data,
            update: data,
          });
          created++;
        } else if (programSpecComparable(toSpec(existing)) === programSpecComparable(r)) {
          skipped++;
        } else {
          await tx.customProgramSpec.update({ where: { id: existing.id }, data });
          updated++;
        }
      }

      return { created, updated, skipped };
    });
  }
}

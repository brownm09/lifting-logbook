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
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { PrismaService } from './prisma.service';

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
    private readonly prisma: PrismaService,
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
   * Idempotency uses a find-then-write per row inside a transaction rather than a
   * DB unique constraint, so re-running the same file yields `created: 0` without
   * requiring a schema migration on `custom_program_spec`.
   */
  async saveProgramSpec(
    program: string,
    rows: LiftingProgramSpec[],
  ): Promise<SaveProgramSpecResult> {
    if (!UUID_PATTERN.test(program)) {
      throw new BadRequestException('Program spec import requires a custom program');
    }

    return this.prisma.$transaction(async (tx) => {
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
          await tx.customProgramSpec.create({ data });
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

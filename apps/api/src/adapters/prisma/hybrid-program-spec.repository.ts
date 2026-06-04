import { LiftingProgramSpec } from '@lifting-logbook/core';
import { ILiftingProgramSpecRepository } from '../../ports/ILiftingProgramSpecRepository';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { PrismaService } from './prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return rows.map((s) => ({
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
    }));
  }
}

import { PrismaClient } from '@prisma/client';
import { ILiftMetadataRepository, LiftMetadata } from '../../ports/ILiftMetadataRepository';

export class PrismaLiftMetadataRepository implements ILiftMetadataRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getMetadata(lift: string): Promise<LiftMetadata | null> {
    const row = await this.prisma.liftMetadata.findUnique({
      where: { userId_lift: { userId: this.userId, lift } },
    });
    if (!row) return null;
    return {
      lift: row.lift,
      muscleGroups: row.muscleGroups,
      substitutions: row.substitutions,
      foundational: row.foundational,
    };
  }

  async upsertMetadata(
    lift: string,
    patch: { muscleGroups?: string[]; substitutions?: string[]; foundational?: string },
  ): Promise<LiftMetadata> {
    const existing = await this.getMetadata(lift);
    const next = {
      muscleGroups: patch.muscleGroups ?? existing?.muscleGroups ?? [],
      substitutions: patch.substitutions ?? existing?.substitutions ?? [],
      foundational: patch.foundational ?? existing?.foundational ?? '',
    };
    const row = await this.prisma.liftMetadata.upsert({
      where: { userId_lift: { userId: this.userId, lift } },
      update: next,
      create: { userId: this.userId, lift, ...next },
    });
    return {
      lift: row.lift,
      muscleGroups: row.muscleGroups,
      substitutions: row.substitutions,
      foundational: row.foundational,
    };
  }
}

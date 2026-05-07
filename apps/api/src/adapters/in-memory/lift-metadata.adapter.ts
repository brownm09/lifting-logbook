import { ILiftMetadataRepository, LiftMetadata } from '../../ports/ILiftMetadataRepository';

export class InMemoryLiftMetadataRepository implements ILiftMetadataRepository {
  private readonly store = new Map<string, LiftMetadata>();

  async getMetadata(lift: string): Promise<LiftMetadata | null> {
    return this.store.get(lift) ?? null;
  }

  async upsertMetadata(
    lift: string,
    patch: { muscleGroups?: string[]; substitutions?: string[]; foundational?: string },
  ): Promise<LiftMetadata> {
    const existing = this.store.get(lift) ?? {
      lift,
      muscleGroups: [],
      substitutions: [],
      foundational: '',
    };
    const updated: LiftMetadata = {
      lift,
      muscleGroups: patch.muscleGroups ?? existing.muscleGroups,
      substitutions: patch.substitutions ?? existing.substitutions,
      foundational: patch.foundational ?? existing.foundational,
    };
    this.store.set(lift, updated);
    return updated;
  }
}

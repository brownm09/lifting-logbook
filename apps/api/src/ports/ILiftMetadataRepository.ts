export interface LiftMetadata {
  lift: string;
  muscleGroups: string[];
  substitutions: string[];
  foundational: string;
}

export interface ILiftMetadataRepository {
  getMetadata(lift: string): Promise<LiftMetadata | null>;
  upsertMetadata(
    lift: string,
    patch: { muscleGroups?: string[]; substitutions?: string[]; foundational?: string },
  ): Promise<LiftMetadata>;
}

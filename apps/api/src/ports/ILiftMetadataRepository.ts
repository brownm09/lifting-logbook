export interface LiftMetadata {
  lift: string;
  muscleGroups: string[];
  substitutions: string[];
  foundational: boolean;
}

export interface ILiftMetadataRepository {
  getMetadata(lift: string): Promise<LiftMetadata | null>;
  upsertMetadata(
    lift: string,
    patch: { muscleGroups?: string[]; substitutions?: string[]; foundational?: boolean },
  ): Promise<LiftMetadata>;
}

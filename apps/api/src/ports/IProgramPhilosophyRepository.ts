export interface ProgramPhilosophy {
  programType: string;
  displayName: string;
  summary: string;
  progressionRules: string;
  trainingMaxGuidance: string;
  deloadGuidance: string;
  notes: string[];
}

export interface IProgramPhilosophyRepository {
  getProgramPhilosophy(programType: string): Promise<ProgramPhilosophy | null>;
  listPrograms(): Promise<ProgramPhilosophy[]>;
}

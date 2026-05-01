import { LiftName } from '@lifting-logbook/types';
import { RepositoryBundle } from './factory';

export interface CyclePlanRequest {
  program: string;
  goal: string;
  cycleNum: number;
}

export interface ProposedTrainingMaxChange {
  lift: LiftName;
  currentWeight: number;
  proposedWeight: number;
  reasoning: string;
}

export interface CyclePlanResult {
  proposedChanges: ProposedTrainingMaxChange[];
  overallReasoning: string;
  partial: boolean;
}

export interface ICyclePlanningAgent {
  plan(repos: RepositoryBundle, request: CyclePlanRequest): Promise<CyclePlanResult>;
}

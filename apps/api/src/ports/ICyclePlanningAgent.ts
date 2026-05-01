import { LiftName } from '@lifting-logbook/types';
import { RepositoryBundle } from './factory';

export type PartialReason = 'deadline' | 'budget' | 'error' | 'no_proposal';

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
  partialReason?: PartialReason;
}

export interface ICyclePlanningAgent {
  plan(repos: RepositoryBundle, request: CyclePlanRequest): Promise<CyclePlanResult>;
}

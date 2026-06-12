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

/**
 * Runs a unit of DB work within an RLS context, returning the repositories scoped to the caller.
 * The agent calls this around each tool dispatch so the DB work runs inside a short-lived
 * RLS transaction while the LLM round-trips happen outside any transaction (issue #518). The
 * controller supplies the implementation (in production it wraps `RlsContextService`).
 */
export type WithRlsContext = <T>(
  fn: (repos: RepositoryBundle) => Promise<T>,
) => Promise<T>;

export interface ICyclePlanningAgent {
  plan(request: CyclePlanRequest, withContext: WithRlsContext): Promise<CyclePlanResult>;
}

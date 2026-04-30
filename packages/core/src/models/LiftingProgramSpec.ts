import { LiftName } from '@lifting-logbook/types';

// RptProgramSpec interface for RPT program specification objects
export interface LiftingProgramSpec {
  week: number;
  offset: number;
  week?: number;
  lift: LiftName;
  increment: number;
  order: number;
  sets: number;
  reps: number;
  amrap: string | boolean;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
}

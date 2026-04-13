import { LiftingProgramSpec } from '@lifting-logbook/core';

export interface ILiftingProgramSpecRepository {
  getProgramSpec(program: string): Promise<LiftingProgramSpec[]>;
}

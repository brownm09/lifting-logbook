import { LiftingProgramSpec } from '@lifting-logbook/core';
import { ILiftingProgramSpecRepository } from '../../ports/ILiftingProgramSpecRepository';
import { SEED_PROGRAM, seedProgramSpec } from './fixtures';

export class InMemoryLiftingProgramSpecRepository
  implements ILiftingProgramSpecRepository
{
  private specByProgram: Map<string, LiftingProgramSpec[]>;

  constructor(preSeed = false) {
    this.specByProgram = preSeed
      ? new Map([[SEED_PROGRAM, seedProgramSpec()]])
      : new Map();
  }

  async getProgramSpec(program: string): Promise<LiftingProgramSpec[]> {
    return this.specByProgram.get(program) ?? [];
  }
}

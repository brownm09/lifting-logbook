import { LiftingProgramSpec } from '@lifting-logbook/core';
import { ILiftingProgramSpecRepository } from '../../ports/ILiftingProgramSpecRepository';
import { SEED_PROGRAM, seedProgramSpec } from './fixtures';

export class InMemoryLiftingProgramSpecRepository
  implements ILiftingProgramSpecRepository
{
  private specByProgram: Map<string, LiftingProgramSpec[]>;

  constructor(_preSeed = false) {
    // Program specs are global (not per-user), so always seed them.
    this.specByProgram = new Map([[SEED_PROGRAM, seedProgramSpec()]]);
  }

  async getProgramSpec(program: string): Promise<LiftingProgramSpec[]> {
    return this.specByProgram.get(program) ?? [];
  }
}

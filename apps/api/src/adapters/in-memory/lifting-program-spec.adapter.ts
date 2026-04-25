import { Injectable } from '@nestjs/common';
import { LiftingProgramSpec } from '@lifting-logbook/core';
import { ILiftingProgramSpecRepository } from '../../ports/ILiftingProgramSpecRepository';
import { SEED_PROGRAM, seedProgramSpec } from './fixtures';

@Injectable()
export class InMemoryLiftingProgramSpecRepository
  implements ILiftingProgramSpecRepository
{
  private specByProgram = new Map<string, LiftingProgramSpec[]>([
    [SEED_PROGRAM, seedProgramSpec()],
  ]);

  async getProgramSpec(program: string): Promise<LiftingProgramSpec[]> {
    return this.specByProgram.get(program) ?? [];
  }
}

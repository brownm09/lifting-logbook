import { BadRequestException } from '@nestjs/common';
import {
  LiftingProgramSpec,
  classifyAndCount,
  programSpecNaturalKey,
  programSpecRowKind,
} from '@lifting-logbook/core';
import {
  ILiftingProgramSpecRepository,
  SaveProgramSpecResult,
} from '../../ports/ILiftingProgramSpecRepository';
import { SEED_PROGRAM, seedProgramSpec } from './fixtures';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  async saveProgramSpec(
    program: string,
    rows: LiftingProgramSpec[],
  ): Promise<SaveProgramSpecResult> {
    if (!UUID_PATTERN.test(program)) {
      throw new BadRequestException('Program spec import requires a custom program');
    }

    const current = [...(this.specByProgram.get(program) ?? [])];
    const existingByKey = new Map(current.map((r) => [programSpecNaturalKey(r), r]));
    const byKey = new Map(existingByKey);

    // Shared classify/dedupe/tally loop + program-spec classifier (#532) so this
    // adapter's counts match the Prisma adapter's and the preview path's.
    const result = await classifyAndCount(
      rows,
      (r) => programSpecNaturalKey(r),
      (r) => programSpecRowKind(r, existingByKey),
      (r) => {
        byKey.set(programSpecNaturalKey(r), r);
      },
    );

    this.specByProgram.set(program, [...byKey.values()]);
    return result;
  }
}

import { BadRequestException } from '@nestjs/common';
import {
  LiftingProgramSpec,
  programSpecComparable,
  programSpecNaturalKey,
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
    const byKey = new Map(current.map((r) => [programSpecNaturalKey(r), r]));
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const r of rows) {
      const key = programSpecNaturalKey(r);
      if (seen.has(key)) continue;
      seen.add(key);
      const prior = byKey.get(key);
      if (!prior) {
        byKey.set(key, r);
        created++;
      } else if (programSpecComparable(prior) === programSpecComparable(r)) {
        skipped++;
      } else {
        byKey.set(key, r);
        updated++;
      }
    }

    this.specByProgram.set(program, [...byKey.values()]);
    return { created, updated, skipped };
  }
}

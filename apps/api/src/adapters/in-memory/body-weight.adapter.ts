import { Injectable } from '@nestjs/common';
import { BodyWeightEntry } from '@lifting-logbook/types';
import { IBodyWeightRepository } from '../../ports/IBodyWeightRepository';

@Injectable()
export class InMemoryBodyWeightRepository implements IBodyWeightRepository {
  private entriesByProgram = new Map<string, BodyWeightEntry[]>();

  async recordBodyWeight(program: string, entry: BodyWeightEntry): Promise<void> {
    const existing = this.entriesByProgram.get(program) ?? [];
    this.entriesByProgram.set(program, [...existing, entry]);
  }

  async getLatestBodyWeight(program: string): Promise<BodyWeightEntry | null> {
    const entries = this.entriesByProgram.get(program) ?? [];
    return entries.length > 0 ? (entries[entries.length - 1] ?? null) : null;
  }
}

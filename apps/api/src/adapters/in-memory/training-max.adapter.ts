import { TrainingMax } from '@lifting-logbook/core';
import { ITrainingMaxRepository } from '../../ports/ITrainingMaxRepository';
import { SEED_PROGRAM, seedTrainingMaxes } from './fixtures';

export class InMemoryTrainingMaxRepository implements ITrainingMaxRepository {
  private maxesByProgram: Map<string, TrainingMax[]>;

  constructor(preSeed = false) {
    this.maxesByProgram = preSeed
      ? new Map([[SEED_PROGRAM, seedTrainingMaxes()]])
      : new Map();
  }

  async getTrainingMaxes(program: string): Promise<TrainingMax[]> {
    return this.maxesByProgram.get(program) ?? [];
  }

  async saveTrainingMaxes(program: string, maxes: TrainingMax[]): Promise<void> {
    this.maxesByProgram.set(program, maxes);
  }
}

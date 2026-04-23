import { Injectable } from '@nestjs/common';
import { TrainingMax } from '@lifting-logbook/core';
import { ITrainingMaxRepository } from '../../ports/ITrainingMaxRepository';
import { SEED_PROGRAM, seedTrainingMaxes } from './fixtures';

@Injectable()
export class InMemoryTrainingMaxRepository implements ITrainingMaxRepository {
  private maxesByProgram = new Map<string, TrainingMax[]>([
    [SEED_PROGRAM, seedTrainingMaxes()],
  ]);

  async getTrainingMaxes(program: string): Promise<TrainingMax[]> {
    return this.maxesByProgram.get(program) ?? [];
  }

  async saveTrainingMaxes(program: string, maxes: TrainingMax[]): Promise<void> {
    this.maxesByProgram.set(program, maxes);
  }
}

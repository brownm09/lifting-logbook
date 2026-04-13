import { TrainingMax } from '@lifting-logbook/core';

export interface ITrainingMaxRepository {
  getTrainingMaxes(program: string): Promise<TrainingMax[]>;

  saveTrainingMaxes(program: string, maxes: TrainingMax[]): Promise<void>;
}

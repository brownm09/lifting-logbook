import { TrainingMaxHistoryEntry } from '@lifting-logbook/core';

export interface TrainingMaxHistoryFilters {
  lift?: string;
  source?: 'test' | 'program';
  isPR?: boolean;
}

export interface ITrainingMaxHistoryRepository {
  getHistory(program: string, filters?: TrainingMaxHistoryFilters): Promise<TrainingMaxHistoryEntry[]>;
  appendHistoryEntries(program: string, entries: Omit<TrainingMaxHistoryEntry, 'id'>[]): Promise<void>;
  updateHistoryEntry(
    program: string,
    id: string,
    update: { isPR?: boolean; goalMet?: boolean },
  ): Promise<TrainingMaxHistoryEntry>;
}

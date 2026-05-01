import { BodyWeightEntry } from '@lifting-logbook/types';

export interface IBodyWeightRepository {
  /** Records a body weight observation for the given program. */
  recordBodyWeight(program: string, entry: BodyWeightEntry): Promise<void>;

  /** Returns the most recent body weight for the given program, or null if none exists. */
  getLatestBodyWeight(program: string): Promise<BodyWeightEntry | null>;
}

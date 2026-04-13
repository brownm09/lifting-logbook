import { LiftName } from '@lifting-logbook/types';

// TrainingMax interface for training max records
export interface TrainingMax {
  dateUpdated: Date;
  lift: LiftName;
  weight: number;
  // [key: string]: any;
}

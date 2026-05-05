export interface TrainingMaxHistoryEntry {
  id: string;
  lift: string;
  weight: number;
  reps: number;
  date: Date;
  isPR: boolean;
  source: 'test' | 'program';
  goalMet: boolean;
}

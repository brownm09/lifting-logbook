export interface StrengthGoalEntry {
  lift: string;
  target: number;
  unit: 'lbs' | 'kg';
  ratio?: number;
  updatedAt: Date;
}

export interface StrengthGoalEntry {
  lift: string;
  goalType: 'absolute' | 'relative';
  target?: number;
  unit: 'lbs' | 'kg';
  ratio?: number;
  updatedAt: Date;
}

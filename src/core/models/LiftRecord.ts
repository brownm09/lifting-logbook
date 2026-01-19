// LiftRecord interface for individual workout log entries
export interface LiftRecord {
  Date: string; // e.g., '1/5/2026'
  Lift: string; // e.g., 'Bench P.'
  Set: string; // e.g., 'Warm-up 1', 'Set 1'
  Weight: number; // e.g., 72.5
  Reps: number | null; // e.g., 5 or null if missing
  Notes?: string; // optional, e.g., 'L:12, R:10'
  [key: string]: any;
}

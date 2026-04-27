export class StartNewCycleDto {
  /** Use records from this cycle number instead of the current cycle. */
  fromCycleNum?: number;
  /** ISO date string (YYYY-MM-DD) to pin the new cycle's start date explicitly. */
  cycleDate?: string;
}

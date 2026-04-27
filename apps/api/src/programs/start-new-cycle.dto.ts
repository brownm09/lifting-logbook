import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class StartNewCycleDto {
  /** Use records from this cycle number instead of the current cycle. */
  @IsOptional()
  @IsInt()
  @Min(1)
  fromCycleNum?: number;

  /** ISO date string (YYYY-MM-DD) to pin the new cycle's start date explicitly. */
  @IsOptional()
  @IsDateString()
  cycleDate?: string;
}

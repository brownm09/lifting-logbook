import { IsDateString, IsOptional } from 'class-validator';

export class InitializeCycleDto {
  @IsOptional()
  @IsDateString()
  cycleDate?: string;
}

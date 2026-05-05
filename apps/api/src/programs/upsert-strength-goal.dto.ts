import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertStrengthGoalDto {
  @IsNumber()
  target: number;

  @IsString()
  @IsIn(['lbs', 'kg'])
  unit: 'lbs' | 'kg';

  @IsNumber()
  @IsOptional()
  ratio?: number;
}

import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertStrengthGoalDto {
  @IsString()
  @IsIn(['absolute', 'relative'])
  goalType: 'absolute' | 'relative';

  @IsNumber()
  @IsOptional()
  target?: number;

  @IsString()
  @IsIn(['lbs', 'kg'])
  unit: 'lbs' | 'kg';

  @IsNumber()
  @IsOptional()
  ratio?: number;
}

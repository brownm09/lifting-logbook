import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTrainingMaxHistoryDto {
  @IsBoolean()
  @IsOptional()
  isPR?: boolean;

  @IsBoolean()
  @IsOptional()
  goalMet?: boolean;
}

import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CyclePlanRequestDto {
  @IsString()
  @MinLength(1)
  program!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  goal!: string;

  @IsInt()
  @Min(1)
  cycleNum!: number;
}

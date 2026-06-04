import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomProgramSpecRowDto {
  @IsInt() @IsIn([1, 2, 3]) week!: number;
  @IsInt() @Min(0) offset!: number;
  @IsString() lift!: string;
  // Must be > 0 — a zero increment makes MROUND divide by zero (NaN weights).
  @IsNumber() @IsPositive() increment!: number;
  @IsInt() @Min(1) order!: number;
  @IsInt() @Min(1) @Max(20) sets!: number;
  @IsInt() @Min(1) @Max(20) reps!: number;
  @IsBoolean() amrap!: boolean;
  @IsString() warmUpPct!: string;
  // Per-set weight drop, as a fraction of TM. A large value drives later sets'
  // work percentage negative; the exact cross-field bound (≤ 1/(sets-1)) is
  // enforced downstream by PROG_SPEC_WORK_PCTS. Here we block the obvious cases.
  @IsNumber() @Min(0) @Max(1) wtDecrementPct!: number;
  @IsString() activation!: string;
  @IsOptional() @IsString() weekType?: string;
}

export class CreateCustomProgramDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() baseTemplate?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CustomProgramSpecRowDto)
  specs!: CustomProgramSpecRowDto[];
}

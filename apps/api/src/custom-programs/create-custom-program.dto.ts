import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
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
  @IsNumber() increment!: number;
  @IsInt() @Min(1) order!: number;
  @IsInt() @Min(1) @Max(20) sets!: number;
  @IsInt() @Min(1) @Max(20) reps!: number;
  @IsBoolean() amrap!: boolean;
  @IsString() warmUpPct!: string;
  @IsNumber() wtDecrementPct!: number;
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

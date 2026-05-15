import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomProgramSpecRowDto {
  @IsNumber() week!: number;
  @IsNumber() offset!: number;
  @IsString() lift!: string;
  @IsNumber() increment!: number;
  @IsNumber() order!: number;
  @IsNumber() sets!: number;
  @IsNumber() reps!: number;
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
  @IsArray() @ValidateNested({ each: true }) @Type(() => CustomProgramSpecRowDto)
  specs!: CustomProgramSpecRowDto[];
}

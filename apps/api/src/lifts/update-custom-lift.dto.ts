import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LiftClassification } from '@lifting-logbook/types';
import { MovementProfileDto } from './movement-profile.dto';

const CLASSIFICATIONS: LiftClassification[] = ['compound', 'accessory'];

export class UpdateCustomLiftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(CLASSIFICATIONS)
  @IsOptional()
  classification?: LiftClassification;

  // Reject primitives that would otherwise bypass @ValidateNested (a silent no-op
  // on non-objects), matching the nested-DTO pattern used elsewhere in the API.
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MovementProfileDto)
  movementProfile?: MovementProfileDto;

  @IsBoolean()
  @IsOptional()
  isBodyweightComponent?: boolean;
}

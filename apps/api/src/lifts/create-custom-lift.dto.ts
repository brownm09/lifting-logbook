import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LiftClassification, MovementTag } from '@lifting-logbook/types';

const CLASSIFICATIONS: LiftClassification[] = ['compound', 'accessory'];
const MOVEMENT_TAGS: MovementTag[] = ['push', 'pull', 'vertical', 'horizontal', 'hinge', 'carry', 'squat'];

export class CreateCustomLiftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsIn(CLASSIFICATIONS)
  classification!: LiftClassification;

  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(MOVEMENT_TAGS, { each: true })
  @IsOptional()
  movementTags?: MovementTag[];

  @IsBoolean()
  @IsOptional()
  isBodyweightComponent?: boolean;
}

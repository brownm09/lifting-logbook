import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Active program changes must go through POST /programs/:program/switch,
// which enforces ownership of custom program UUIDs.

@ValidatorConstraint({ name: 'IsWeekPatternArray', async: false })
class IsWeekPatternArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value) || value.length < 1 || value.length > 8) return false;
    for (const week of value) {
      if (!Array.isArray(week) || week.length < 1 || week.length > 7) return false;
      const seen = new Set<number>();
      for (const day of week) {
        if (!Number.isInteger(day) || day < 0 || day > 6) return false;
        if (seen.has(day)) return false;
        seen.add(day);
      }
    }
    return true;
  }
  defaultMessage(): string {
    return 'weeks must be 1-8 arrays of unique day indices (0-6)';
  }
}

export class WorkoutScheduleDto {
  @IsIn(['fixed', 'rotating'])
  type!: 'fixed' | 'rotating';

  @ValidateIf((o: WorkoutScheduleDto) => o.type === 'fixed')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days?: number[];

  @ValidateIf((o: WorkoutScheduleDto) => o.type === 'rotating')
  @Validate(IsWeekPatternArrayConstraint)
  weeks?: number[][];
}

export class UpdateSettingsDto {
  // null clears the schedule; undefined leaves it unchanged.
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkoutScheduleDto)
  workoutSchedule?: WorkoutScheduleDto | null;
}

import { ArrayMaxSize, IsArray, IsIn, IsString } from 'class-validator';
import {
  JointAction,
  MovementComplexity,
  MovementProfile,
  MovementTag,
} from '@lifting-logbook/types';

export const MOVEMENT_TAGS: MovementTag[] = [
  'push',
  'pull',
  'vertical',
  'horizontal',
  'hinge',
  'carry',
  'squat',
];

export const JOINT_ACTIONS: JointAction[] = [
  'flexion',
  'extension',
  'internal-rotation',
  'external-rotation',
  'abduction',
  'adduction',
];

export const COMPLEXITIES: MovementComplexity[] = ['simple', 'compound'];

/**
 * Nested request shape for a lift's combined movement profile. Validated via
 * `@ValidateNested()` + `@Type()` on the owning DTOs (the global ValidationPipe
 * runs with `whitelist: true`; nested objects are guarded by `@IsObject()` there
 * so primitives can't bypass the no-op).
 */
export class MovementProfileDto implements MovementProfile {
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(MOVEMENT_TAGS, { each: true })
  patterns!: MovementTag[];

  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(JOINT_ACTIONS, { each: true })
  jointActions!: JointAction[];

  @IsString()
  @IsIn(COMPLEXITIES)
  complexity!: MovementComplexity;
}

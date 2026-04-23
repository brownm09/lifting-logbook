import { Module } from '@nestjs/common';
import { InMemoryCycleDashboardRepository } from '../adapters/in-memory/cycle-dashboard.adapter';
import { InMemoryLiftRecordRepository } from '../adapters/in-memory/lift-record.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../adapters/in-memory/lifting-program-spec.adapter';
import { InMemoryTrainingMaxRepository } from '../adapters/in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../adapters/in-memory/workout.adapter';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  TRAINING_MAX_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports/tokens';
import { CycleDashboardController } from './cycle-dashboard.controller';
import { LiftRecordsController } from './lift-records.controller';
import { ProgramSpecController } from './program-spec.controller';
import { TrainingMaxesController } from './training-maxes.controller';
import { WorkoutsController } from './workouts.controller';

/**
 * Wires controllers to in-memory adapters via port tokens. Adapters are
 * provider-singletons; replace with real Sheets adapters + per-user factory
 * when auth lands (see follow-up issue).
 */
@Module({
  controllers: [
    CycleDashboardController,
    WorkoutsController,
    TrainingMaxesController,
    LiftRecordsController,
    ProgramSpecController,
  ],
  providers: [
    {
      provide: CYCLE_DASHBOARD_REPOSITORY,
      useClass: InMemoryCycleDashboardRepository,
    },
    { provide: WORKOUT_REPOSITORY, useClass: InMemoryWorkoutRepository },
    {
      provide: TRAINING_MAX_REPOSITORY,
      useClass: InMemoryTrainingMaxRepository,
    },
    { provide: LIFT_RECORD_REPOSITORY, useClass: InMemoryLiftRecordRepository },
    {
      provide: LIFTING_PROGRAM_SPEC_REPOSITORY,
      useClass: InMemoryLiftingProgramSpecRepository,
    },
  ],
})
export class ProgramsModule {}

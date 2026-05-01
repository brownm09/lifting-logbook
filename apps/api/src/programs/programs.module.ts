import { Module } from '@nestjs/common';
import { InMemoryBodyWeightRepository } from '../adapters/in-memory/body-weight.adapter';
import { InMemoryCycleDashboardRepository } from '../adapters/in-memory/cycle-dashboard.adapter';
import { InMemoryLiftRecordRepository } from '../adapters/in-memory/lift-record.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../adapters/in-memory/lifting-program-spec.adapter';
import { InMemoryProgramPhilosophyRepository } from '../adapters/in-memory/program-philosophy.adapter';
import { InMemoryTrainingMaxRepository } from '../adapters/in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../adapters/in-memory/workout.adapter';
import { cyclePlanningAgentProvider } from '../adapters/llm/cycle-planning-provider.factory';
import {
  BODY_WEIGHT_REPOSITORY,
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  PROGRAM_PHILOSOPHY_REPOSITORY,
  TRAINING_MAX_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports/tokens';
import { BodyWeightController } from './body-weight.controller';
import { CycleDashboardController } from './cycle-dashboard.controller';
import { CycleGenerationController } from './cycle-generation.controller';
import { CycleGenerationService } from './cycle-generation.service';
import { CyclePlanController } from './cycle-plan.controller';
import { LiftRecordsController } from './lift-records.controller';
import { ProgramSpecController } from './program-spec.controller';
import { TrainingMaxesController } from './training-maxes.controller';
import { WorkoutsController } from './workouts.controller';

/**
 * Wires controllers to in-memory adapters via port tokens. Adapters are
 * provider-singletons; replace with real Sheets adapters + `Scope.REQUEST`
 * (or a per-user factory) when auth lands. The skipped test
 * `isolates adapter state per request` in `programs.e2e.spec.ts` is the
 * forcing function for that wiring decision.
 */
@Module({
  controllers: [
    BodyWeightController,
    CycleDashboardController,
    CycleGenerationController,
    CyclePlanController,
    WorkoutsController,
    TrainingMaxesController,
    LiftRecordsController,
    ProgramSpecController,
  ],
  providers: [
    { provide: BODY_WEIGHT_REPOSITORY, useClass: InMemoryBodyWeightRepository },
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
    {
      provide: PROGRAM_PHILOSOPHY_REPOSITORY,
      useClass: InMemoryProgramPhilosophyRepository,
    },
    cyclePlanningAgentProvider,
    CycleGenerationService,
  ],
})
export class ProgramsModule {}

import { Module } from '@nestjs/common';
import { InMemoryBodyWeightRepository } from '../adapters/in-memory/body-weight.adapter';
import { cyclePlanningAgentProvider } from '../adapters/llm/cycle-planning-provider.factory';
import { BODY_WEIGHT_REPOSITORY } from '../ports/tokens';
import { BodyWeightController } from './body-weight.controller';
import { CycleDashboardController } from './cycle-dashboard.controller';
import { CycleGenerationController } from './cycle-generation.controller';
import { CycleGenerationService } from './cycle-generation.service';
import { CyclePlanController } from './cycle-plan.controller';
import { LiftRecordsController } from './lift-records.controller';
import { ProgramSpecController } from './program-spec.controller';
import { StrengthGoalsController } from './strength-goals.controller';
import { TrainingMaxesController } from './training-maxes.controller';
import { TrainingMaxHistoryController } from './training-max-history.controller';
import { WorkoutsController } from './workouts.controller';

@Module({
  controllers: [
    BodyWeightController,
    CycleDashboardController,
    CycleGenerationController,
    CyclePlanController,
    WorkoutsController,
    StrengthGoalsController,
    TrainingMaxesController,
    TrainingMaxHistoryController,
    LiftRecordsController,
    ProgramSpecController,
  ],
  providers: [
    { provide: BODY_WEIGHT_REPOSITORY, useClass: InMemoryBodyWeightRepository },
    cyclePlanningAgentProvider,
    CycleGenerationService,
  ],
})
export class ProgramsModule {}

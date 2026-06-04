import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { PrismaService } from './prisma.service';
import { PrismaCustomLiftRepository } from './custom-lift.repository';
import { PrismaCycleDashboardRepository } from './cycle-dashboard.repository';
import { PrismaCycleScheduledWorkoutRepository } from './cycle-scheduled-workout.repository';
import { PrismaLiftMetadataRepository } from './lift-metadata.repository';
import { PrismaLiftRecordRepository } from './lift-record.repository';
import { PrismaStrengthGoalRepository } from './strength-goal.repository';
import { PrismaTrainingMaxRepository } from './training-max.repository';
import { PrismaTrainingMaxHistoryRepository } from './training-max-history.repository';
import { PrismaWorkoutDateOverrideRepository } from './workout-date-override.repository';
import { PrismaWorkoutLiftOverrideRepository } from './workout-lift-override.repository';
import { PrismaWorkoutSkipOverrideRepository } from './workout-skip-override.repository';
import { PrismaWorkoutRepository } from './workout.repository';
import { HybridLiftingProgramSpecRepository } from './hybrid-program-spec.repository';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { UserSettingsRepository } from '../../user-settings/user-settings.repository';

@Injectable()
export class PrismaRepositoryFactory implements IRepositoryFactory {
  // Built-in program philosophy is user-independent, so it can be a singleton. The
  // spec repo's custom-program branch must be scoped to the requesting user, so a
  // thin per-user wrapper is built in forUser() — but its built-in spec data is
  // global, so the in-memory delegate is shared here rather than rebuilt (and
  // re-seeded) on every request.
  private readonly philosophyRepo = new InMemoryProgramPhilosophyRepository();
  private readonly inMemorySpecRepo = new InMemoryLiftingProgramSpecRepository();

  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    return {
      customLift: new PrismaCustomLiftRepository(this.prisma, user.id),
      cycleDashboard: new PrismaCycleDashboardRepository(this.prisma, user.id),
      cycleScheduledWorkout: new PrismaCycleScheduledWorkoutRepository(this.prisma, user.id),
      liftMetadata: new PrismaLiftMetadataRepository(this.prisma, user.id),
      liftRecord: new PrismaLiftRecordRepository(this.prisma, user.id),
      programPhilosophy: this.philosophyRepo,
      strengthGoal: new PrismaStrengthGoalRepository(this.prisma, user.id),
      trainingMax: new PrismaTrainingMaxRepository(this.prisma, user.id),
      trainingMaxHistory: new PrismaTrainingMaxHistoryRepository(this.prisma, user.id),
      userSettings: new UserSettingsRepository(this.prisma, user.id),
      workout: new PrismaWorkoutRepository(this.prisma, user.id),
      workoutDateOverride: new PrismaWorkoutDateOverrideRepository(this.prisma, user.id),
      workoutLiftOverride: new PrismaWorkoutLiftOverrideRepository(this.prisma, user.id),
      workoutSkipOverride: new PrismaWorkoutSkipOverrideRepository(this.prisma, user.id),
      liftingProgramSpec: new HybridLiftingProgramSpecRepository(
        this.prisma,
        user.id,
        this.inMemorySpecRepo,
      ),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { PrismaService } from './prisma.service';
import { PrismaCycleDashboardRepository } from './cycle-dashboard.repository';
import { PrismaCycleScheduledWorkoutRepository } from './cycle-scheduled-workout.repository';
import { PrismaLiftMetadataRepository } from './lift-metadata.repository';
import { PrismaLiftRecordRepository } from './lift-record.repository';
import { PrismaStrengthGoalRepository } from './strength-goal.repository';
import { PrismaTrainingMaxRepository } from './training-max.repository';
import { PrismaTrainingMaxHistoryRepository } from './training-max-history.repository';
import { PrismaWorkoutDateOverrideRepository } from './workout-date-override.repository';
import { PrismaWorkoutLiftOverrideRepository } from './workout-lift-override.repository';
import { PrismaWorkoutRepository } from './workout.repository';
import { HybridLiftingProgramSpecRepository } from './hybrid-program-spec.repository';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';
import { UserSettingsRepository } from '../../user-settings/user-settings.repository';

@Injectable()
export class PrismaRepositoryFactory implements IRepositoryFactory {
  // Spec repo handles both in-memory built-in programs and DB-backed custom programs.
  private readonly programSpecRepo: HybridLiftingProgramSpecRepository;
  private readonly philosophyRepo = new InMemoryProgramPhilosophyRepository();

  constructor(private readonly prisma: PrismaService) {
    this.programSpecRepo = new HybridLiftingProgramSpecRepository(prisma);
  }

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    return {
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
      liftingProgramSpec: this.programSpecRepo,
    };
  }
}

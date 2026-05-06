import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { PrismaService } from './prisma.service';
import { PrismaLiftRecordRepository } from './lift-record.repository';
import { PrismaStrengthGoalRepository } from './strength-goal.repository';
import { PrismaTrainingMaxRepository } from './training-max.repository';
import { PrismaTrainingMaxHistoryRepository } from './training-max-history.repository';
import { PrismaCycleDashboardRepository } from './cycle-dashboard.repository';
import { PrismaWorkoutDateOverrideRepository } from './workout-date-override.repository';
import { PrismaWorkoutRepository } from './workout.repository';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';

@Injectable()
export class PrismaRepositoryFactory implements IRepositoryFactory {
  // Static data repos are shared — they hold no per-user mutable state.
  private readonly programSpecRepo = new InMemoryLiftingProgramSpecRepository();
  private readonly philosophyRepo = new InMemoryProgramPhilosophyRepository();

  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    return {
      liftRecord: new PrismaLiftRecordRepository(this.prisma, user.id),
      strengthGoal: new PrismaStrengthGoalRepository(this.prisma, user.id),
      trainingMax: new PrismaTrainingMaxRepository(this.prisma, user.id),
      trainingMaxHistory: new PrismaTrainingMaxHistoryRepository(this.prisma, user.id),
      cycleDashboard: new PrismaCycleDashboardRepository(this.prisma, user.id),
      workout: new PrismaWorkoutRepository(this.prisma, user.id),
      workoutDateOverride: new PrismaWorkoutDateOverrideRepository(this.prisma, user.id),
      liftingProgramSpec: this.programSpecRepo,
      programPhilosophy: this.philosophyRepo,
    };
  }
}

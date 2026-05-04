import { Injectable } from '@nestjs/common';
import { LiftRecord } from '@lifting-logbook/core';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { InMemoryCycleDashboardRepository } from '../in-memory/cycle-dashboard.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { InMemoryLiftRecordRepository } from '../in-memory/lift-record.adapter';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';
import { InMemoryTrainingMaxRepository } from '../in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../in-memory/workout.adapter';
import { SEED_PROGRAM, seedLiftRecords } from '../in-memory/fixtures';

// The dev seed user gets pre-populated training maxes so existing tests that
// rely on seeded data continue to work without additional setup.
const SEED_USER_ID = process.env.DEV_USER_ID ?? 'dev-token';

@Injectable()
export class InMemoryRepositoryFactory implements IRepositoryFactory {
  private readonly bundles = new Map<string, RepositoryBundle>();

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    if (!this.bundles.has(user.id)) {
      const preSeed = user.id === SEED_USER_ID;
      // liftRecord and workout share one backing store so POSTed records are
      // immediately visible via GET /workouts/:workoutNum (mirrors Prisma behavior).
      const sharedRecords: Map<string, LiftRecord[]> = preSeed
        ? new Map([[SEED_PROGRAM, seedLiftRecords()]])
        : new Map();
      this.bundles.set(user.id, {
        cycleDashboard: new InMemoryCycleDashboardRepository(preSeed),
        liftingProgramSpec: new InMemoryLiftingProgramSpecRepository(preSeed),
        liftRecord: new InMemoryLiftRecordRepository(sharedRecords),
        programPhilosophy: new InMemoryProgramPhilosophyRepository(),
        trainingMax: new InMemoryTrainingMaxRepository(preSeed),
        workout: new InMemoryWorkoutRepository(sharedRecords),
      });
    }
    return this.bundles.get(user.id)!;
  }
}

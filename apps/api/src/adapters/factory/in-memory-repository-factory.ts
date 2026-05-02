import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { InMemoryCycleDashboardRepository } from '../in-memory/cycle-dashboard.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { InMemoryLiftRecordRepository } from '../in-memory/lift-record.adapter';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';
import { InMemoryTrainingMaxRepository } from '../in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../in-memory/workout.adapter';

// The dev seed user gets pre-populated training maxes so existing tests that
// rely on seeded data continue to work without additional setup.
const SEED_USER_ID = process.env.DEV_USER_ID ?? 'dev-token';

@Injectable()
export class InMemoryRepositoryFactory implements IRepositoryFactory {
  private readonly bundles = new Map<string, RepositoryBundle>();

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    if (!this.bundles.has(user.id)) {
      this.bundles.set(user.id, {
        cycleDashboard: new InMemoryCycleDashboardRepository(),
        liftingProgramSpec: new InMemoryLiftingProgramSpecRepository(),
        liftRecord: new InMemoryLiftRecordRepository(),
        programPhilosophy: new InMemoryProgramPhilosophyRepository(),
        trainingMax: new InMemoryTrainingMaxRepository(user.id === SEED_USER_ID),
        workout: new InMemoryWorkoutRepository(),
      });
    }
    return this.bundles.get(user.id)!;
  }
}

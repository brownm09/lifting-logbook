import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { InMemoryCycleDashboardRepository } from '../in-memory/cycle-dashboard.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../in-memory/lifting-program-spec.adapter';
import { InMemoryLiftRecordRepository } from '../in-memory/lift-record.adapter';
import { InMemoryProgramPhilosophyRepository } from '../in-memory/program-philosophy.adapter';
import { InMemoryTrainingMaxRepository } from '../in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../in-memory/workout.adapter';

interface UserDataSourceRow {
  adapter_type: string;
  adapter_config: unknown;
}

interface CachedEntry {
  bundle: RepositoryBundle;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class SystemDbRepositoryFactory implements IRepositoryFactory, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly cache = new Map<string, CachedEntry>();

  constructor() {
    this.pool = new Pool({ connectionString: process.env.SYSTEM_DATABASE_URL });
  }

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    const cached = this.cache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.bundle;
    }

    const result = await this.pool.query<UserDataSourceRow>(
      'SELECT adapter_type, adapter_config FROM user_data_source WHERE user_id = $1',
      [user.id],
    );

    const row = result.rows[0];
    const bundle = this.makeBundle(row?.adapter_type ?? 'in-memory', row?.adapter_config);
    this.cache.set(user.id, { bundle, expiresAt: Date.now() + TTL_MS });
    return bundle;
  }

  // Only 'in-memory' is supported in v0.3; per-user adapter types (Sheets, Postgres) follow.
  private makeBundle(_adapterType: string, _config: unknown): RepositoryBundle {
    return {
      cycleDashboard: new InMemoryCycleDashboardRepository(),
      liftingProgramSpec: new InMemoryLiftingProgramSpecRepository(),
      liftRecord: new InMemoryLiftRecordRepository(),
      programPhilosophy: new InMemoryProgramPhilosophyRepository(),
      trainingMax: new InMemoryTrainingMaxRepository(),
      workout: new InMemoryWorkoutRepository(),
    };
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

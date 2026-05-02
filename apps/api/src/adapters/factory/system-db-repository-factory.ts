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

@Injectable()
export class SystemDbRepositoryFactory implements IRepositoryFactory, OnModuleDestroy {
  private readonly pool: Pool;
  // Bundles are kept permanently — TTL eviction would discard mutable in-memory state.
  // When real persistent adapters land, replace this with adapter handle caching.
  private readonly bundles = new Map<string, RepositoryBundle>();
  private readonly inFlight = new Map<string, Promise<RepositoryBundle>>();

  constructor() {
    this.pool = new Pool({ connectionString: process.env.SYSTEM_DATABASE_URL });
  }

  async forUser(user: AuthUser): Promise<RepositoryBundle> {
    const existing = this.bundles.get(user.id);
    if (existing) return existing;

    // Single-flight: coalesce concurrent first-time requests for the same user.
    let pending = this.inFlight.get(user.id);
    if (!pending) {
      pending = this.createBundle(user.id).finally(() => {
        this.inFlight.delete(user.id);
      });
      this.inFlight.set(user.id, pending);
    }
    return pending;
  }

  private async createBundle(userId: string): Promise<RepositoryBundle> {
    const result = await this.pool.query<UserDataSourceRow>(
      'SELECT adapter_type, adapter_config FROM user_data_source WHERE user_id = $1',
      [userId],
    );

    const row = result.rows[0];
    const bundle = this.makeBundle(row?.adapter_type ?? 'in-memory', row?.adapter_config);
    this.bundles.set(userId, bundle);
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

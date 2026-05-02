import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { AuthUser } from '../../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../../ports/factory';
import { PrismaLiftRecordRepository } from '../prisma/lift-record.repository';
import { PrismaTrainingMaxRepository } from '../prisma/training-max.repository';
import { PrismaCycleDashboardRepository } from '../prisma/cycle-dashboard.repository';
import { PrismaWorkoutRepository } from '../prisma/workout.repository';
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
  private readonly bundles = new Map<string, RepositoryBundle>();
  private readonly inFlight = new Map<string, Promise<RepositoryBundle>>();
  // Lazily initialised when the first 'postgres' adapter_type is encountered.
  private prisma: PrismaClient | null = null;
  // Static data repos are shared across all users — they hold no per-user mutable state.
  private readonly programSpecRepo = new InMemoryLiftingProgramSpecRepository();
  private readonly philosophyRepo = new InMemoryProgramPhilosophyRepository();

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
    const bundle = this.makeBundle(userId, row?.adapter_type ?? 'in-memory', row?.adapter_config);
    this.bundles.set(userId, bundle);
    return bundle;
  }

  private makeBundle(userId: string, adapterType: string, _config: unknown): RepositoryBundle {
    if (adapterType === 'postgres') {
      const prisma = this.getOrCreatePrisma();
      return {
        liftRecord: new PrismaLiftRecordRepository(prisma, userId),
        trainingMax: new PrismaTrainingMaxRepository(prisma, userId),
        cycleDashboard: new PrismaCycleDashboardRepository(prisma, userId),
        workout: new PrismaWorkoutRepository(prisma, userId),
        liftingProgramSpec: this.programSpecRepo,
        programPhilosophy: this.philosophyRepo,
      };
    }

    return {
      cycleDashboard: new InMemoryCycleDashboardRepository(),
      liftingProgramSpec: this.programSpecRepo,
      liftRecord: new InMemoryLiftRecordRepository(),
      programPhilosophy: this.philosophyRepo,
      trainingMax: new InMemoryTrainingMaxRepository(),
      workout: new InMemoryWorkoutRepository(),
    };
  }

  private getOrCreatePrisma(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL ?? '' } },
      });
    }
    return this.prisma;
  }

  async onModuleDestroy() {
    await Promise.all([this.pool.end(), this.prisma?.$disconnect()]);
  }
}

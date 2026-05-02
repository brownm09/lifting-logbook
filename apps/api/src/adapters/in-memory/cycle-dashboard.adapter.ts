import { CycleDashboard } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../../ports/ICycleDashboardRepository';
import { ProgramNotFoundError } from '../../ports/errors';
import { SEED_PROGRAM, seedCycleDashboard } from './fixtures';

export class InMemoryCycleDashboardRepository
  implements ICycleDashboardRepository
{
  private dashboards: Map<string, CycleDashboard>;

  constructor(preSeed = false) {
    this.dashboards = preSeed
      ? new Map([[SEED_PROGRAM, seedCycleDashboard()]])
      : new Map();
  }

  async getCycleDashboard(program: string): Promise<CycleDashboard> {
    const dashboard = this.dashboards.get(program);
    if (!dashboard) {
      throw new ProgramNotFoundError(program);
    }
    return dashboard;
  }

  async saveCycleDashboard(dashboard: CycleDashboard): Promise<void> {
    this.dashboards.set(dashboard.program, dashboard);
  }
}

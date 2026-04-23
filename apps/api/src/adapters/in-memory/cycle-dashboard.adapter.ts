import { Injectable, NotFoundException } from '@nestjs/common';
import { CycleDashboard } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../../ports/ICycleDashboardRepository';
import { SEED_PROGRAM, seedCycleDashboard } from './fixtures';

@Injectable()
export class InMemoryCycleDashboardRepository
  implements ICycleDashboardRepository
{
  private dashboards = new Map<string, CycleDashboard>([
    [SEED_PROGRAM, seedCycleDashboard()],
  ]);

  async getCycleDashboard(program: string): Promise<CycleDashboard> {
    const dashboard = this.dashboards.get(program);
    if (!dashboard) {
      throw new NotFoundException(`Program '${program}' not found`);
    }
    return dashboard;
  }

  async saveCycleDashboard(dashboard: CycleDashboard): Promise<void> {
    this.dashboards.set(dashboard.program, dashboard);
  }
}

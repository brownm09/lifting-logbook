import { CycleDashboard } from '@lifting-logbook/core';

export interface ICycleDashboardRepository {
  getCycleDashboard(program: string): Promise<CycleDashboard>;

  saveCycleDashboard(dashboard: CycleDashboard): Promise<void>;
}

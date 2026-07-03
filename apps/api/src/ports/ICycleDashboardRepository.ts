import { CycleDashboard } from '@lifting-logbook/core';

export interface ICycleDashboardRepository {
  getCycleDashboard(program: string): Promise<CycleDashboard>;

  saveCycleDashboard(dashboard: CycleDashboard): Promise<void>;

  /** Deletes the cycle dashboard row for a program. No-op if none exists. */
  deleteCycleDashboard(program: string): Promise<void>;
}

// DashboardCycle model for dashboard cycle records
export interface CycleDashboard {
  program: string;
  cycleUnit: string;
  cycleNum: number;
  cycleDate: string;
  sheetName: string;
  [key: string]: any;
}

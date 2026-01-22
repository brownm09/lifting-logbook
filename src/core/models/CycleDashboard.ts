// DashboardCycle model for dashboard cycle records
export interface CycleDashboard {
  program: string;
  cycleUnit: string;
  cycleNum: number;
  cycleDate: Date;
  sheetName: string;
  [key: string]: any;
}

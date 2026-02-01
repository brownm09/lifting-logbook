// DashboardCycle model for dashboard cycle records
export enum Weekday {
  Sunday = "Sunday",
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
}

export interface CycleDashboard {
  program: string;
  cycleUnit: string;
  cycleNum: number;
  cycleDate: Date;
  sheetName: string;
  cycleStartWeekday: Weekday;
  [key: string]: any;
}

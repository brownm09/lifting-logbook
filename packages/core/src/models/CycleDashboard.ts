import { WeekType } from '@lifting-logbook/types';

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
  // Derived at request time via weekTypeForDate(); not stored on the dashboard sheet.
  currentWeekType?: WeekType;
  programType?: string;
}

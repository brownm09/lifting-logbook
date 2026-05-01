import {
  CycleDashboard,
  LiftRecord,
  LiftingProgramSpec,
  TrainingMax,
  Weekday,
} from '@lifting-logbook/core';

/**
 * Seed data for the in-memory adapters used in v0.2 to wire the API end-to-end
 * before real persistence (Google Sheets adapters + auth) lands. One program,
 * one cycle, enough records to render the "today's workout" UI path.
 */

export const SEED_PROGRAM = '5-3-1';

export const seedCycleDashboard = (): CycleDashboard => ({
  program: SEED_PROGRAM,
  cycleUnit: 'week',
  cycleNum: 1,
  cycleDate: new Date('2026-04-20T00:00:00.000Z'),
  sheetName: '',
  cycleStartWeekday: Weekday.Monday,
  currentWeekType: 'training',
});

export const seedTrainingMaxes = (): TrainingMax[] => [
  { lift: 'Squat', weight: 315, dateUpdated: new Date('2026-04-13T00:00:00.000Z') },
  { lift: 'Bench Press', weight: 225, dateUpdated: new Date('2026-04-13T00:00:00.000Z') },
  { lift: 'Deadlift', weight: 405, dateUpdated: new Date('2026-04-13T00:00:00.000Z') },
  { lift: 'Overhead Press', weight: 145, dateUpdated: new Date('2026-04-13T00:00:00.000Z') },
];

export const seedLiftRecords = (): LiftRecord[] => [
  {
    program: SEED_PROGRAM,
    cycleNum: 1,
    workoutNum: 1,
    date: new Date('2026-04-20T00:00:00.000Z'),
    lift: 'Squat',
    setNum: 1,
    weight: 205,
    reps: 5,
    notes: '',
  },
  {
    program: SEED_PROGRAM,
    cycleNum: 1,
    workoutNum: 1,
    date: new Date('2026-04-20T00:00:00.000Z'),
    lift: 'Squat',
    setNum: 2,
    weight: 235,
    reps: 5,
    notes: '',
  },
  {
    program: SEED_PROGRAM,
    cycleNum: 1,
    workoutNum: 1,
    date: new Date('2026-04-20T00:00:00.000Z'),
    lift: 'Squat',
    setNum: 3,
    weight: 265,
    reps: 5,
    notes: 'AMRAP',
  },
];

export const seedProgramSpec = (): LiftingProgramSpec[] => [
  {
    week: 1,
    offset: 0,
    lift: 'Squat',
    increment: 5,
    order: 1,
    sets: 3,
    reps: 5,
    amrap: true,
    warmUpPct: '0.4,0.5,0.6',
    wtDecrementPct: 0.1,
    activation: 'compound',
  },
  {
    week: 1,
    offset: 0,
    lift: 'Bench Press',
    increment: 5,
    order: 2,
    sets: 3,
    reps: 5,
    amrap: true,
    warmUpPct: '0.4,0.5,0.6',
    wtDecrementPct: 0.1,
    activation: 'compound',
  },
];

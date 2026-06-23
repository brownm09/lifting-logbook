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
export const SEED_LEANGAINS = 'leangains';

export const seedCycleDashboard = (): CycleDashboard => ({
  program: SEED_PROGRAM,
  cycleUnit: 'week',
  cycleNum: 1,
  cycleDate: new Date('2026-04-20T00:00:00.000Z'),
  sheetName: '',
  cycleStartWeekday: Weekday.Monday,
  programType: '5-3-1',
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

export const seedLeangainsSpec = (): LiftingProgramSpec[] => [
  // Day A — offset 0 (Mon: Chest / Back)
  { week: 1, offset: 0, lift: 'Bench Press',       order: 1, sets: 3, reps: 6,  amrap: true,  increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 0, lift: 'Weighted Pull-ups', order: 2, sets: 3, reps: 6,  amrap: true,  increment: 2.5, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 0, lift: 'Incline DB Press',  order: 3, sets: 3, reps: 8,  amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
  { week: 1, offset: 0, lift: 'Cable Row',         order: 4, sets: 3, reps: 10, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
  // Day B — offset 2 (Wed: Legs)
  { week: 1, offset: 2, lift: 'Squat',             order: 1, sets: 3, reps: 6,  amrap: true,  increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 2, lift: 'Romanian Deadlift', order: 2, sets: 3, reps: 8,  amrap: false, increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
  { week: 1, offset: 2, lift: 'Leg Curl',          order: 3, sets: 3, reps: 10, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
  { week: 1, offset: 2, lift: 'Calf Raises',       order: 4, sets: 4, reps: 12, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
  // Day C — offset 4 (Fri: Shoulders / Arms)
  { week: 1, offset: 4, lift: 'Overhead Press',    order: 1, sets: 3, reps: 6,  amrap: true,  increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 4, lift: 'Deadlift',          order: 2, sets: 1, reps: 5,  amrap: false, increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
  { week: 1, offset: 4, lift: 'Lateral Raises',    order: 3, sets: 4, reps: 12, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
  { week: 1, offset: 4, lift: 'Dips',              order: 4, sets: 3, reps: 8,  amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
];

export const seedProgramSpec = (): LiftingProgramSpec[] => [
  // Week 1: 3×5 (65/75/85 % TM)
  { week: 1, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 1, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  // Week 2: 3×3 (70/80/90 % TM)
  { week: 2, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 2, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 2, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 2, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  // Week 3: 5/3/1 (75/85/95 % TM, last set AMRAP)
  { week: 3, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 3, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 3, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  { week: 3, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
];

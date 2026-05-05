import type {
  CycleWeekSummary,
  LiftingProgramSpecResponse,
} from '@lifting-logbook/types';

export type PhaseType = 'training' | 'deload' | 'test';
export type PhaseStatus = 'completed' | 'in-progress' | 'upcoming';

export interface ProgramPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  type: PhaseType;
  status: PhaseStatus;
}

export interface ProgramSummary {
  durationWeeks: number;
  frequency: number;
  exercises: string[];
  warmUpSets: number;
  workingSets: number;
}

// Standard 5-3-1 block phase map (12-week cycle).
const PHASE_MAP_12: Array<{ name: string; startWeek: number; endWeek: number; type: PhaseType }> = [
  { name: 'Accumulation', startWeek: 1, endWeek: 3, type: 'training' },
  { name: 'Deload', startWeek: 4, endWeek: 4, type: 'deload' },
  { name: 'Intensification', startWeek: 5, endWeek: 7, type: 'training' },
  { name: 'Deload', startWeek: 8, endWeek: 8, type: 'deload' },
  { name: 'Realization', startWeek: 9, endWeek: 11, type: 'training' },
  { name: 'Test', startWeek: 12, endWeek: 12, type: 'test' },
];

function phaseStatus(
  phase: { startWeek: number; endWeek: number },
  weekMap: Map<number, CycleWeekSummary>,
  today: string,
): PhaseStatus {
  const weeks = Array.from(
    { length: phase.endWeek - phase.startWeek + 1 },
    (_, i) => phase.startWeek + i,
  );
  const summaries = weeks.map((w) => weekMap.get(w));
  if (summaries.every((s) => s?.completed)) return 'completed';
  const hasStarted = summaries.some((s) =>
    s?.workoutDates.some((d) => d <= today),
  );
  return hasStarted ? 'in-progress' : 'upcoming';
}

export function deriveProgramPhases(
  weeks: CycleWeekSummary[],
  today: string,
): ProgramPhase[] {
  const weekMap = new Map(weeks.map((w) => [w.week, w]));
  const totalWeeks = Math.max(...weeks.map((w) => w.week), 0);

  const template = totalWeeks === 12
    ? PHASE_MAP_12
    : buildFallbackPhases(totalWeeks);

  return template.map((p) => ({
    ...p,
    status: phaseStatus(p, weekMap, today),
  }));
}

// For programs other than 12 weeks: last week = test, second-to-last = deload if ≥2 weeks,
// remaining weeks = training.
function buildFallbackPhases(
  totalWeeks: number,
): Array<{ name: string; startWeek: number; endWeek: number; type: PhaseType }> {
  if (totalWeeks <= 0) return [];
  if (totalWeeks === 1) return [{ name: 'Test', startWeek: 1, endWeek: 1, type: 'test' }];
  return [
    { name: 'Training', startWeek: 1, endWeek: totalWeeks - 1, type: 'training' },
    { name: 'Test', startWeek: totalWeeks, endWeek: totalWeeks, type: 'test' },
  ];
}

export function deriveProgramSummary(
  specs: LiftingProgramSpecResponse[],
): ProgramSummary {
  const durationWeeks = Math.max(...specs.map((s) => s.week), 0);

  const week1Specs = specs.filter((s) => s.week === 1);
  const frequency = new Set(week1Specs.map((s) => s.offset)).size;

  const exercises = [...new Set(specs.map((s) => s.lift))];

  const firstSpec = week1Specs[0];
  const warmUpSets = firstSpec?.warmUpPct?.split(',').filter(Boolean).length ?? 0;
  const workingSets = firstSpec?.sets ?? 0;

  return { durationWeeks, frequency, exercises, warmUpSets, workingSets };
}

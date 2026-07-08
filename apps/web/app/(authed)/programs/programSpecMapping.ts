// Pure day/instance <-> CustomProgramSpecRow mapping for the program editor.
//
// The editor models a program as an ordered list of workout days, each holding
// ordered exercise *instances*. A single lift may appear on multiple days (or
// more than once within a day) because an instance is keyed by its position
// (day index -> `offset`, within-day index -> `order`), never by lift name.
//
// The persisted shape (CustomProgramSpecRow[]) is flat: one row per
// (week, offset, lift, order). The day/instance structure is shared across the
// editor's three weeks; only the loading params (sets/reps/etc.) vary per week.
// These helpers convert between the two shapes. They are kept free of React /
// Next imports so they can be unit-tested directly. See issue #751.
import type { CustomProgramSpecRow } from '@lifting-logbook/types';

/** The editor edits exactly these three weeks (matches the API DTO's `@IsIn([1,2,3])`). */
export const WEEKS = [1, 2, 3] as const;
export type EditableWeek = (typeof WEEKS)[number];

/** Defensive UI bounds — the API imposes no array max, so the client caps size. */
export const MAX_DAYS = 7;
export const MAX_INSTANCES_PER_DAY = 12;

/**
 * All CustomProgramSpecRow loading fields — including wtDecrementPct / activation
 * / weekType that the editor UI does not surface — so an edit/clone round-trip
 * carries them through without data loss.
 */
export type WeekParams = {
  sets: number;
  reps: number;
  amrap: boolean;
  increment: number;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
  weekType?: string;
};

export type ExerciseInstance = {
  /** Client-only React key; never serialized to the API. */
  id: string;
  lift: string;
  weeks: Record<EditableWeek, WeekParams>;
};

export type WorkoutDayModel = {
  /** Client-only React key; never serialized to the API. */
  id: string;
  instances: ExerciseInstance[];
};

let idCounter = 0;
/** Monotonic client-only id for stable React keys. Deterministic across SSR/hydration. */
export function uid(): string {
  idCounter += 1;
  return `pe-${idCounter}`;
}

/** Loading params for a freshly added instance — mirrors the pre-#751 DEFAULT_ROW. */
export function defaultWeekParams(increment: number): WeekParams {
  return {
    sets: 3,
    reps: 5,
    amrap: false,
    increment,
    warmUpPct: '0.4,0.5,0.6',
    wtDecrementPct: 0.1,
    activation: 'compound',
  };
}

/** Three identical default weeks for a new instance. */
export function defaultWeeks(increment: number): Record<EditableWeek, WeekParams> {
  return {
    1: defaultWeekParams(increment),
    2: defaultWeekParams(increment),
    3: defaultWeekParams(increment),
  };
}

function pickWeekParams(row: CustomProgramSpecRow): WeekParams {
  const params: WeekParams = {
    sets: row.sets,
    reps: row.reps,
    amrap: row.amrap,
    increment: row.increment,
    warmUpPct: row.warmUpPct,
    wtDecrementPct: row.wtDecrementPct,
    activation: row.activation,
  };
  if (row.weekType !== undefined) params.weekType = row.weekType;
  return params;
}

/**
 * Flattens the day/instance model to persisted rows.
 *
 * - `offset` = day index among *non-empty* days (contiguous 0,1,2,… so empty
 *   days emit nothing and never open a gap).
 * - `order` = 1-based position of the instance within its day (the API requires
 *   `order >= 1`).
 * - one row per (week × instance); weeks are always 1/2/3.
 *
 * Only the CustomProgramSpecRow fields are emitted — the client-only `id` never
 * reaches the wire (the API's ValidationPipe rejects unknown props).
 */
export function specsFromDays(days: WorkoutDayModel[]): CustomProgramSpecRow[] {
  const rows: CustomProgramSpecRow[] = [];
  days
    .filter((day) => day.instances.length > 0)
    .forEach((day, dayIdx) => {
      day.instances.forEach((inst, i) => {
        for (const week of WEEKS) {
          rows.push({
            week,
            offset: dayIdx,
            order: i + 1,
            lift: inst.lift,
            ...inst.weeks[week],
          });
        }
      });
    });
  return rows;
}

/**
 * Reconstructs the day/instance model from persisted rows.
 *
 * Rows are grouped into days by `offset` (ascending) and into instances by
 * `order` (ascending) within a day. An instance's lift is taken from its week-1
 * row (constant across weeks for a given position); a week with no row falls
 * back to week 1, then to the first row present. Legacy programs whose rows are
 * all `offset: 0` collapse to a single populated day.
 */
export function daysFromSpecs(specs: CustomProgramSpecRow[]): WorkoutDayModel[] {
  const byOffset = new Map<number, CustomProgramSpecRow[]>();
  for (const s of specs) {
    const arr = byOffset.get(s.offset);
    if (arr) arr.push(s);
    else byOffset.set(s.offset, [s]);
  }

  return [...byOffset.keys()]
    .sort((a, b) => a - b)
    .map((offset) => {
      const rows = byOffset.get(offset) ?? [];
      const byOrder = new Map<number, CustomProgramSpecRow[]>();
      for (const r of rows) {
        const arr = byOrder.get(r.order);
        if (arr) arr.push(r);
        else byOrder.set(r.order, [r]);
      }

      const instances: ExerciseInstance[] = [...byOrder.keys()]
        .sort((a, b) => a - b)
        .map((order) => {
          const orderRows = byOrder.get(order) ?? [];
          const lift = (orderRows.find((r) => r.week === 1) ?? orderRows[0]).lift;
          const pick = (w: EditableWeek): WeekParams => {
            const row =
              orderRows.find((r) => r.week === w) ??
              orderRows.find((r) => r.week === 1) ??
              orderRows[0];
            return pickWeekParams(row);
          };
          return { id: uid(), lift, weeks: { 1: pick(1), 2: pick(2), 3: pick(3) } };
        });

      return { id: uid(), instances };
    });
}

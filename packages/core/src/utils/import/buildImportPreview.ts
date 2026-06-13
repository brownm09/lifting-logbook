import { ImportDelta, ImportPreview } from '@lifting-logbook/types';
import {
  LiftRecord,
  LiftingProgramSpec,
  StrengthGoalEntry,
  TrainingMax,
} from '../../models';
import { liftRecordNaturalKey } from './liftRecordNaturalKey';

/**
 * Pure before→after diff builders for the Smart Import preview step (#477).
 *
 * Each returns `{ creates, updates, skips, deltas }` by comparing the incoming
 * (validated) rows against what is already stored, using the same key each
 * type's write path keys on. No I/O — the caller supplies the existing rows.
 */

function tally(deltas: ImportDelta[]): ImportPreview {
  return {
    creates: deltas.filter((d) => d.kind === 'create').length,
    updates: deltas.filter((d) => d.kind === 'update').length,
    skips: deltas.filter((d) => d.kind === 'skip').length,
    deltas,
  };
}

/** Natural key for a program-spec row: `week:offset:lift:order`. */
export function programSpecNaturalKey(r: {
  week: number;
  offset: number;
  lift: string;
  order: number;
}): string {
  return `${r.week}:${r.offset}:${r.lift}:${r.order}`;
}

/**
 * Lift records are append-only: a row either creates (new natural key) or skips
 * (key already present). Duplicate keys within the file collapse to one entry.
 */
export function buildLiftRecordsPreview(
  incoming: LiftRecord[],
  existing: LiftRecord[],
): ImportPreview {
  const existingKeys = new Set(existing.map(liftRecordNaturalKey));
  const seen = new Set<string>();
  const deltas: ImportDelta[] = [];

  for (const r of incoming) {
    const key = liftRecordNaturalKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `${r.lift} · cycle ${r.cycleNum} workout ${r.workoutNum} set ${r.setNum}`;
    const value = `${r.weight} × ${r.reps}`;
    if (existingKeys.has(key)) {
      deltas.push({ key, label, kind: 'skip', before: value, after: value });
    } else {
      deltas.push({ key, label, kind: 'create', after: value });
    }
  }
  return tally(deltas);
}

/**
 * Outcome of importing a single (deduped) upsert-by-lift row against stored data.
 * The create/update/skip *decision* lives here so the preview builders and the
 * repository commit methods classify identically — preview and commit can never
 * disagree on the counts (issue #488).
 */
export type ImportRowKind = 'create' | 'update' | 'skip';

/** Classify one training-max row vs the stored maxes (keyed by lift). */
export function trainingMaxRowKind(
  m: TrainingMax,
  existingByLift: Map<string, number>,
): ImportRowKind {
  const before = existingByLift.get(m.lift);
  if (before === undefined) return 'create';
  return `${before}` === `${m.weight}` ? 'skip' : 'update';
}

/** Classify one strength-goal row vs the stored goals (keyed by lift). */
export function strengthGoalRowKind(
  g: StrengthGoalEntry,
  existingByLift: Map<string, StrengthGoalEntry>,
): ImportRowKind {
  const prior = existingByLift.get(g.lift);
  if (!prior) return 'create';
  return goalValue(prior) === goalValue(g) ? 'skip' : 'update';
}

/** Training maxes upsert by `lift`: create if absent, update if the weight differs, else skip. */
export function buildTrainingMaxPreview(
  incoming: TrainingMax[],
  existing: TrainingMax[],
): ImportPreview {
  const existingByLift = new Map(existing.map((m) => [m.lift, m.weight]));
  const seen = new Set<string>();
  const deltas: ImportDelta[] = [];

  for (const m of incoming) {
    if (seen.has(m.lift)) continue;
    seen.add(m.lift);
    const after = `${m.weight}`;
    const kind = trainingMaxRowKind(m, existingByLift);
    const before = existingByLift.get(m.lift);
    deltas.push(
      before === undefined
        ? { key: m.lift, label: m.lift, kind, after }
        : { key: m.lift, label: m.lift, kind, before: `${before}`, after },
    );
  }
  return tally(deltas);
}

function goalValue(g: StrengthGoalEntry): string {
  return g.goalType === 'relative'
    ? `${g.ratio}× bodyweight`
    : `${g.target} ${g.unit}`;
}

/** Strength goals upsert by `lift`: create if absent, update if any field differs, else skip. */
export function buildStrengthGoalPreview(
  incoming: StrengthGoalEntry[],
  existing: StrengthGoalEntry[],
): ImportPreview {
  const existingByLift = new Map(existing.map((g) => [g.lift, g]));
  const seen = new Set<string>();
  const deltas: ImportDelta[] = [];

  for (const g of incoming) {
    if (seen.has(g.lift)) continue;
    seen.add(g.lift);
    const after = goalValue(g);
    const kind = strengthGoalRowKind(g, existingByLift);
    const prior = existingByLift.get(g.lift);
    deltas.push(
      prior
        ? { key: g.lift, label: g.lift, kind, before: goalValue(prior), after }
        : { key: g.lift, label: g.lift, kind, after },
    );
  }
  return tally(deltas);
}

function specValue(r: LiftingProgramSpec): string {
  const amrap = r.amrap === true || r.amrap === 'TRUE' ? ' AMRAP' : '';
  return `${r.sets}×${r.reps}${amrap} @ ${r.warmUpPct}`;
}

/**
 * Canonical serialization of a program-spec row's writable fields (everything
 * except its natural key). Preview and commit both compare on this string so the
 * "update vs skip" decision is identical in both places.
 */
export function programSpecComparable(r: LiftingProgramSpec): string {
  const amrap = r.amrap === true || r.amrap === 'TRUE';
  return JSON.stringify({
    increment: r.increment,
    sets: r.sets,
    reps: r.reps,
    amrap,
    warmUpPct: r.warmUpPct,
    wtDecrementPct: r.wtDecrementPct,
    activation: r.activation,
    weekType: r.weekType ?? null,
  });
}

/** Program-spec rows upsert by natural key: create if absent, update if config differs, else skip. */
export function buildProgramSpecPreview(
  incoming: LiftingProgramSpec[],
  existing: LiftingProgramSpec[],
): ImportPreview {
  const existingByKey = new Map(existing.map((r) => [programSpecNaturalKey(r), r]));
  const seen = new Set<string>();
  const deltas: ImportDelta[] = [];

  for (const r of incoming) {
    const key = programSpecNaturalKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `Week ${r.week} · ${r.lift} (#${r.order})`;
    const after = specValue(r);
    const prior = existingByKey.get(key);
    if (!prior) {
      deltas.push({ key, label, kind: 'create', after });
    } else {
      const unchanged = programSpecComparable(prior) === programSpecComparable(r);
      deltas.push({
        key,
        label,
        kind: unchanged ? 'skip' : 'update',
        before: specValue(prior),
        after,
      });
    }
  }
  return tally(deltas);
}

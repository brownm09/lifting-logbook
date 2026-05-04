import { LiftingProgramSpec, LiftRecord, TrainingMax } from "@src/core/models";

const ABNORMAL_KEYWORDS = ['injury', 'unusual stimulus', 'skip'];

function isAbnormal(notes: string): boolean {
  const lower = notes.toLowerCase();
  return ABNORMAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/** A computed TM update that would reduce the current max — requires explicit user review. */
export interface MaxReductionFlag {
  lift: string;
  currentWeight: number;
  proposedWeight: number;
}

export interface UpdateMaxesResult {
  maxes: TrainingMax[];
  flagged: MaxReductionFlag[];
}

/**
 * Updates training maxes based on lift records and program spec.
 *
 * Behavior varies by weekType:
 *  - 'training' (default): progression gate is set 1 reps >= spec.reps; new TM = weight + increment.
 *  - 'test': uses final set (setNum === spec.sets); any non-zero reps without abnormal notes → new TM = weight (no increment).
 *            Abnormal-notes fallback: walk backwards through sets until an unaffected set is found.
 *  - 'deload': no progression — returns input maxes unchanged.
 *
 * In both training and test weeks, if the computed new TM would be lower than the current TM,
 * the update is NOT applied. Instead the lift is added to `flagged` so the caller can surface
 * the proposed reduction for explicit user review.
 */
export function updateMaxes(
  programSpec: LiftingProgramSpec[],
  trainingMaxes: TrainingMax[],
  liftRecords: LiftRecord[],
): UpdateMaxesResult {
  const newMaxes: TrainingMax[] = trainingMaxes.map((tm) => ({ ...tm }));
  const flagged: MaxReductionFlag[] = [];

  liftRecords.forEach((record) => {
    const liftName = record.lift;
    const tmIndex = newMaxes.findIndex((tm) => tm.lift === liftName);

    if (tmIndex === -1) throw new Error(`Training max for lift ${liftName} not found.`);

    const currentMax = newMaxes[tmIndex]!;
    const spec = programSpec.find((ps) => ps.lift === liftName);
    if (!spec) throw new Error(`Program spec for lift ${liftName} not found.`);

    const weekType = spec.weekType ?? 'training';

    if (weekType === 'deload') return;

    if (weekType === 'test') {
      // Only process when we see the final set, then walk backwards to find the best
      // unaffected set (in case the final set was flagged as abnormal).
      if (record.setNum !== spec.sets) return;

      // Gather all records for this lift in the same workout
      const liftSetRecords = liftRecords
        .filter((r) => r.lift === liftName && r.workoutNum === record.workoutNum)
        .sort((a, b) => b.setNum - a.setNum); // descending: best attempt first

      const candidate = liftSetRecords.find((r) => r.reps > 0 && !isAbnormal(r.notes));
      if (
        candidate &&
        new Date(candidate.date).getTime() > new Date(currentMax.dateUpdated).getTime()
      ) {
        if (candidate.weight < currentMax.weight) {
          flagged.push({ lift: liftName, currentWeight: currentMax.weight, proposedWeight: candidate.weight });
        } else {
          currentMax.weight = candidate.weight;
          currentMax.dateUpdated = candidate.date;
        }
      }
      return;
    }

    // training week: process set 1 only
    if (record.setNum !== 1) return;

    if (
      record.reps >= spec.reps &&
      new Date(record.date).getTime() > new Date(currentMax.dateUpdated).getTime()
    ) {
      const updatedWeight = record.weight + spec.increment;
      if (typeof updatedWeight !== "number" || isNaN(updatedWeight)) {
        throw new Error(`Updated weight for ${liftName} is not a valid number: ${updatedWeight}`);
      }
      if (updatedWeight < currentMax.weight) {
        flagged.push({ lift: liftName, currentWeight: currentMax.weight, proposedWeight: updatedWeight });
      } else {
        currentMax.weight = updatedWeight;
        currentMax.dateUpdated = record.date;
      }
    }
  });

  return { maxes: newMaxes, flagged };
}

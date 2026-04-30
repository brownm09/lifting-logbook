# Proposal: Initial Training Max Discovery

**Status:** `draft`
**Date:** 2026-04-30
**Issue:** [#129](https://github.com/brownm09/lifting-logbook/issues/129)

---

## Problem

Training maxes are the single input that drives every working set weight calculation in the
app. `updateMaxes` throws an error if a max for any configured lift is missing, which means a
user cannot start their first cycle without maxes already in the system. The training max
management screen (shipped, #108) addresses users who already know their 1RMs, but two other
onboarding paths have no data model support:

**Estimation (mechanism 2):** The user does not know their exact 1RM but has recent performance
data — e.g., "I did 225 lbs for 5 reps last month." A standard rep-max formula (Brzycki) can
back-calculate a training max from any (weight, reps) pair. The system has no utility for this,
and the training max management screen has no input for it.

**Test week (mechanism 3):** The user has no reliable data and needs to determine their maxes
by actually lifting. This requires a structured "test week" — a special cycle phase with a
ramp-up protocol (ascending sets culminating in a heavy set of 1–3 reps) — so the system can
generate weights, accept logged results, and derive the training max. Currently, `CycleDashboard`,
`LiftingProgramSpec`, and `generateLiftPlan` have no concept of a week type or phase; a test
week is indistinguishable from a regular training week at the data and API layer.

## Proposed Solution

Three coordinated changes:

**1. `WeekType` — a new shared type**

Add `WeekType` (`'training' | 'test' | 'deload'`) to `packages/types/src/domain.ts`. Add an
optional `weekType?: WeekType` field to `LiftingProgramSpec` (default: `'training'`).
`CycleDashboard` gains a derived `currentWeekType: WeekType` field computed from the active
week's spec rows. The Sheets parser reads an optional `Week Type` column; blank/missing maps
to `'training'`.

**2. `estimateTrainingMax` — a new core utility**

Add `estimateTrainingMax(weight: number, reps: number): number` to `packages/core` using the
Brzycki formula: `1RM = weight / (1.0278 − 0.0278 × reps)`. Result rounds to the nearest 5
lbs. Exported from the package's public API and surfaced in the training max management screen
as an optional "estimate from reps" input.

**3. Test-week ramp-up protocol**

When `weekType === 'test'`, `generateLiftPlan` produces a 5-set ascending ramp-up ending in a
heavy set of 1–3 reps (e.g., 50% × 5, 65% × 3, 80% × 2, 90% × 1, 100% × 1). `updateMaxes`
is relaxed for test weeks: the `reps >= spec.reps` gate is replaced by "any completed final
set" — that set's weight becomes the new training max (no increment applied). `GET
/programs/:program/cycle-dashboard` response includes `currentWeekType`.

## Acceptance Criteria

- [ ] `WeekType` (`'training' | 'test' | 'deload'`) exported from `packages/types/src/domain.ts`
- [ ] `LiftingProgramSpec.weekType?: WeekType` added; parser default is `'training'`
- [ ] Sheets parser reads optional `Week Type` column; blank/missing → `'training'`
- [ ] `CycleDashboard.currentWeekType: WeekType` derived from the active week's spec rows
- [ ] `estimateTrainingMax(weight, reps): number` in `packages/core` using Brzycki formula,
      rounded to nearest 5 lbs; exported from package public API
- [ ] `generateLiftPlan` handles `weekType === 'test'`: 5-set ascending ramp-up to ~100% TM × 1–3
- [ ] `updateMaxes` for test weeks: completed final set weight → new TM (no increment)
- [ ] `GET /programs/:program/cycle-dashboard` response includes `currentWeekType`
- [ ] Unit tests in `packages/core` cover `estimateTrainingMax` and the test-week branches of
      `generateLiftPlan` and `updateMaxes`

## Out of Scope

- Importing historical data from external sources (separate proposal)
- Deload-week progression logic (deferred per PRD Non-Goals)
- React Native (`apps/mobile`) client for the test-week UX
- Mechanism (1): covered by #108 (shipped)

## References

- [`packages/types/src/domain.ts`](../../packages/types/src/domain.ts) — where `WeekType` enum belongs
- [`packages/core/src/models/LiftingProgramSpec.ts`](../../packages/core/src/models/LiftingProgramSpec.ts) — model to extend with `weekType`
- [`packages/core/src/models/CycleDashboard.ts`](../../packages/core/src/models/CycleDashboard.ts) — model to extend with `currentWeekType`
- [`packages/core/src/services/maxes/updateMaxes.ts`](../../packages/core/src/services/maxes/updateMaxes.ts) — progression gate to relax for test weeks
- [`packages/core/src/services/workout/generateLiftPlan.ts`](../../packages/core/src/services/workout/generateLiftPlan.ts) — ramp-up protocol generation basis
- PRD §Non-Goals — "Deload / missed-session recovery" explicitly deferred; `test` week is a distinct concept in scope
- Brzycki, M. (1993). "Strength Testing—Predicting a One-Rep Max from Reps-to-Fatigue." *JOPERD* 64(1):88–90.

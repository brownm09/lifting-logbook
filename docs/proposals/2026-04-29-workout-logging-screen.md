# Proposal: Workout Logging Screen

**Status:** `draft`
**Date:** 2026-04-29
**Issue:** [#106](https://github.com/brownm09/lifting-logbook/issues/106)

---

## Problem

The API has endpoints for reading planned workouts (`GET /workouts`) and recording lift data
(`POST /lift-records`, `POST /body-weight`), but there is no web UI for a lifter to log a
session at the gym. Without this screen the primary job-to-be-done — recording a completed
workout in under 2 minutes — is impossible. It is also the delivery point for the
bodyweight-component added-weight calculation (J4): bodyweight is entered at session start and
used to compute added weight for exercises like weighted chin-ups and dips.

## Proposed Solution

Build a workout logging screen at `/cycle/:cycleNum/workout/:workoutNum`. The screen presents
one exercise at a time, with navigation dots to jump between exercises and a toggle to a
whole-workout overview.

**Bodyweight gate:** If the workout contains bodyweight-component exercises, a bodyweight entry
prompt appears before the lift list is shown. The entered value is posted to `POST /body-weight`
and used client-side by `calculateAddedWeight` to compute added weight for those lifts.

**Per-exercise view:** Each exercise shows warm-up sets (read-only, calculated from
`warmUpPct` in the program spec via `packages/core` math) followed by working sets with
editable weight and reps fields. Warm-up weights for bodyweight-component exercises are
calculated identically to barbell exercises (same percentage formula applied to total training
load). For exercises where warm-up sets fall below the lifter's bodyweight, the sets are
shown as `BW × n`; once warm-up percentages exceed bodyweight they display added weight
(`+X lb × n`). The warm-up implement (e.g., lat pulldown for weighted chin-ups, unweighted
dips for weighted dips) is hard-coded per exercise in this iteration. A bottom strip previews
the next exercise's name and first warm-up weight; when the current exercise is last, the
strip reads "Last exercise."

**Working sets:** Weight and reps are pre-filled from the program spec. The lifter adjusts
actuals and taps Log per set; each submission posts to `POST /lift-records` and marks the set
complete (inputs locked, ✓ shown). A logged set can be re-opened for editing within the same
session; re-submission sends a `PATCH /lift-records/:id` to update the record in place.
Editing requires a new API endpoint — `PATCH /programs/:program/lift-records/:id` accepting
a partial `UpdateLiftRecordRequest` (weight, reps, notes).

**Per-set notes:** An optional free-text notes field is shown below weight/reps on each working
set. The value is included in the `notes` field of `CreateLiftRecordRequest` (and
`UpdateLiftRecordRequest` for edits). This is legacy functionality — the field already exists
in the API; the UI is the only addition required.

When all sets across all exercises are logged, a "Finish workout" action navigates
back to the cycle dashboard.

**Whole-workout view:** A toggle (⊞) switches to a scrollable list of all exercises showing
warm-up weights (compressed to a summary line) and working set status. Each exercise has a
"Resume" / "Go to" button that returns to the per-exercise view at that exercise.

**Read-only mode:** When navigated to from a completed workout, all inputs are disabled and
existing lift records are displayed.

## Acceptance Criteria

- [ ] `/cycle/:cycleNum/workout/:workoutNum` fetches and renders the workout plan from
      `GET /workouts`
- [ ] If the workout contains ≥ 1 bodyweight-component lift, a bodyweight entry step is shown
      first; submission posts to `POST /body-weight` before the lift list is revealed
- [ ] Warm-up sets are shown read-only above working sets for every exercise; weights are
      derived from `warmUpPct` in `LiftingProgramSpecResponse` via `packages/core` — no
      warm-up math duplicated in the UI
- [ ] Warm-up sets for bodyweight-component exercises display `BW × n` when the calculated
      weight is at or below bodyweight, and `+X lb × n` when above; the warm-up implement
      name (e.g., "lat pulldown", "dips") is shown as a label above the warm-up list
- [ ] Working set weights are pre-filled: barbell lifts use `calculateLiftWeights`, bodyweight-
      component lifts use `calculateAddedWeight(targetLoad, bodyWeight)` from `packages/core`
- [ ] The lifter can adjust weight and reps per set; tapping Log posts to `POST /lift-records`
      and marks the set complete (inputs locked, ✓ shown)
- [ ] A logged set can be re-opened for editing within the same session; re-submission sends
      `PATCH /programs/:program/lift-records/:id` and updates the displayed record in place
- [ ] An optional notes field is shown per working set; the value is posted in the `notes`
      field of `CreateLiftRecordRequest` / `UpdateLiftRecordRequest`
- [ ] Navigation dots above the exercise name are tappable to jump to any exercise
- [ ] A bottom strip shows the next exercise name and its first warm-up weight; on the last
      exercise the strip reads "Last exercise"
- [ ] When all sets across all exercises are logged, "Finish workout" navigates to
      `/cycle/:cycleNum`
- [ ] A ⊞ toggle switches to a whole-workout overview listing all exercises with warm-up
      summary, working set status, and Resume / Go to buttons
- [ ] When reached from a completed workout (read-only mode), all inputs are disabled and
      existing lift records are displayed
- [ ] Touch targets are ≥ 44 px; screen is usable at ≥ 375 px viewport width without
      horizontal scroll

## Out of Scope

- Per-lift (per-exercise) notes
- Rest timer between sets
- Offline / service-worker support
- React Native (`apps/mobile`) — web only

## Open Questions

The warm-up implement for each exercise (e.g., lat pulldown for weighted chin-ups, unweighted
dips for weighted dips) is hard-coded in this iteration. A follow-on issue should make
warm-up protocols configurable per exercise — including the implement name, the number of
warm-up sets, and the percentage steps — so users can match their actual gym warm-up routine.

## References

- [`packages/core/src/services/bodyWeight.ts`](../../packages/core/src/services/bodyWeight.ts) — `calculateAddedWeight` to reuse client-side
- [`packages/core/src/services/workout/calculateLiftWeights.ts`](../../packages/core/src/services/workout/calculateLiftWeights.ts) — working set weight calculation
- [`packages/types/src/api.ts`](../../packages/types/src/api.ts) — `WorkoutResponse`, `CreateLiftRecordRequest`, `RecordBodyWeightRequest`, `LiftingProgramSpecResponse`; needs new `UpdateLiftRecordRequest` type
- [`apps/api/src/programs/lift-records.controller.ts`](../../apps/api/src/programs/lift-records.controller.ts) — needs `PATCH /:id` handler added alongside the existing `GET`
- PRD §Jobs to Be Done — J1 (log without friction, ≤ 2 min), J4 (bodyweight-component target weight)

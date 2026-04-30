# Proposal: Training Max Management Screen

**Status:** `draft`
**Date:** 2026-04-29
**Issue:** [#108](https://github.com/brownm09/lifting-logbook/issues/108)

---

## Problem

Training maxes (1RMs) are the single input that drives every working set weight calculation in
the app. The API supports reading and updating them (`GET /training-maxes`,
`PATCH /training-maxes`), but there is no web UI. A lifter who wants to review their current
maxes, correct an entry, or manually set a starting max for a new cycle has no way to do so
without querying the API directly. Without this screen the calculated weights shown on the
cycle dashboard and workout logging screen cannot be trusted or corrected.

## Proposed Solution

Build a training max management screen at `/settings/training-maxes`. The screen lists every
lift in the user's program alongside its current training max and the date it was last updated.
Each row is editable — the lifter taps a weight to change it, then saves. Saving submits the
changed values via `PATCH /training-maxes` and confirms the update in-place. The screen
respects the user's unit preference (lbs / kg) throughout. It is accessible from the cycle
dashboard via a Settings link in the nav and is usable before the first cycle is created to
set opening maxes.

## Acceptance Criteria

- [ ] `GET /training-maxes` is called on load; each lift is shown with its current training
      max and last-updated date
- [ ] Each row is editable; tapping the weight field opens an inline editor (or number input
      on desktop)
- [ ] Saving changed values submits via `PATCH /training-maxes`; the row reflects the updated
      value and date on success
- [ ] Validation rejects non-positive weights and non-numeric input before submission
- [ ] Unit preference (lbs / kg) is respected: values are displayed and accepted in the user's
      preferred unit
- [ ] Lifts with no recorded max are shown with a placeholder and can be set for the first
      time
- [ ] Screen is usable at ≥ 375 px viewport width; touch targets ≥ 44 px

## Out of Scope

- Training max history or trend view (past values over time)
- Automated progression — the API and `packages/core` handle max progression after a logged
  workout; this screen is for manual review and correction only
- Per-lift progression configuration (increment, decrement percentages)
- React Native (`apps/mobile`) — web only

## References

- [`packages/types/src/api.ts`](../../packages/types/src/api.ts) — `TrainingMaxResponse`, `UpdateTrainingMaxesRequest`
- [`packages/core/src/services/maxes/updateMaxes.ts`](../../packages/core/src/services/maxes/updateMaxes.ts) — progression logic (context for what this screen does *not* duplicate)
- PRD §Jobs to Be Done — J2 (know what weight to use next session)

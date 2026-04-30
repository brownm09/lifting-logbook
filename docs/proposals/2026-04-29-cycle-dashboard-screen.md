# Proposal: Cycle Dashboard Screen

**Status:** `draft`
**Date:** 2026-04-29
**Issue:** [#104](https://github.com/brownm09/lifting-logbook/issues/104)

---

## Problem

The application has a complete API for cycle data (`GET /cycle-dashboard`, `GET /program-spec`)
and all progression math in `packages/core`, but no web UI. A lifter preparing for a session
has no way to see their current training cycle — which weeks are done, what workouts are coming
up, or what target weights are planned — without querying the API directly. This screen is the
central navigation hub the rest of the client application depends on.

## Proposed Solution

Build a cycle dashboard screen at `/cycle` (resolves automatically to the current active cycle;
bookmarkable) and `/cycle/:cycleNum` (specific cycle by number). The screen displays a
week-by-week grid (4 weeks × planned workouts) showing each workout's date, completion status,
and planned lift weights. Planned weights are computed client-side using `calculateLiftWeights`
from `packages/core` against the program spec and current training maxes — no duplicate math in
the UI layer. Bodyweight-component exercises show their total training load (same format as
barbell lifts); the added-weight breakdown is deferred to the workout logging screen.

Clicking a completed workout navigates to `/cycle/:cycleNum/workout/:workoutNum` in read-only
review mode. Clicking an upcoming workout navigates to the same route in logging mode.

## Acceptance Criteria

- [ ] `/cycle` resolves to the current active cycle and renders the dashboard
- [ ] `/cycle/:cycleNum` renders the dashboard for an explicit cycle number; shows a
      404-equivalent state if the cycle does not exist
- [ ] Dashboard displays a 4-week grid; each cell shows the workout date, completion badge
      (Completed / Upcoming / Missed), and the planned lifts with target weights
- [ ] Planned weights are derived from `GET /program-spec` + `GET /training-maxes` via
      `calculateLiftWeights` in `packages/core` — no recalculation in the UI
- [ ] Bodyweight-component exercises display total training load (not added weight) in the
      dashboard; added-weight breakdown is shown only in the workout logging screen
- [ ] Clicking a completed workout navigates to the workout detail screen (read-only)
- [ ] Clicking an upcoming workout navigates to the workout logging screen
- [ ] Screen is usable at mobile browser viewport widths (≥ 375px) without horizontal scroll;
      completed weeks collapse by default on mobile, current week is expanded

## Out of Scope

- Cycle-to-cycle navigation or a history browser (past cycles)
- Creating or editing cycle configuration from the dashboard
- Inline editing of workout records from the dashboard
- React Native (`apps/mobile`) — web only for this proposal

## References

- [`packages/core/src/services/workout/calculateLiftWeights.ts`](../../packages/core/src/services/workout/calculateLiftWeights.ts) — progression math to reuse client-side
- [`packages/types/src/api.ts`](../../packages/types/src/api.ts) — `CycleDashboardResponse`, `LiftingProgramSpecResponse`, `TrainingMaxResponse`
- ADR-015 (`docs/adr/ADR-015-graphql-dataloader.md`) — DataLoader design for batch-loading cycle data if this screen moves to GraphQL

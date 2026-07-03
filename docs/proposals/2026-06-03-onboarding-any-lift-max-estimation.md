# Proposal: Onboarding — Estimate Maxes for Any Catalog or Custom Lift

**Status:** `shipped`
**Date:** 2026-06-03
**Issue:** [#426](https://github.com/brownm09/lifting-logbook/issues/426)

---

## Problem

The onboarding wizard's "Enter Lifts" step is hardcoded to exactly three lifts — Bench Press, Back Squat,
and Deadlift — via `LiftKey = 'bench' | 'squat' | 'deadlift'` and the `LIFT_LABELS` record in
`apps/web/app/(authed)/onboarding/lib.ts`. A lifter whose program centers on other movements (Overhead
Press, Barbell Row, weighted Chin-up) cannot seed those maxes during setup, and there is no path at all for
a lift outside the catalog. The product goal — let a user submit a recent heavy set for **any** lift,
catalog or custom, and have its max estimated — is unmet.

There is a second, latent defect in the same flow: **the maxes the wizard computes are never persisted.**
`OnboardingFlow.tsx` computes `computedMaxes` and displays them on the Confirm step, but `handleConfirm`
calls `createFirstCycle(selectedProgramId)` (`onboarding/actions.ts`) with only the program id — the
entered maxes are discarded, and the user lands on `/cycle/1` with no training maxes set from onboarding.

## Proposed Solution

Make the "Enter Lifts" step a dynamic, user-managed list and persist the confirmed maxes on completion.

**1. Dynamic lift list**

Replace the fixed `LiftKey` union and `LIFT_LABELS` record with a list of lift rows the user can add to and
remove from. Seed the list with the three big lifts so a zero-config user sees no change, but allow **add a
row** by selecting any lift from the built-in catalog **or any custom lift** (per the
[custom-lifts proposal](2026-06-03-custom-lifts.md)). Reuse the existing lift-picker / type-ahead component
built for the manage-lifts screen rather than introducing a new selector.

**2. Estimation unchanged**

Continue using the client-side `brzycki1RM` helper (`onboarding/lib.ts`) for the live on-screen estimate,
which mirrors the canonical core utility `estimateTrainingMax`
(`packages/core/src/services/maxes/estimateTrainingMax.ts`). Rep-range guidance ("stay under 10 reps for
accuracy") is preserved.

*(Update, 2026-07-02: the two implementations drifted apart and were consolidated onto a single
implementation in `packages/core` — see [issue #642](https://github.com/brownm09/lifting-logbook/issues/642).
The live estimate now calls `estimateOneRepMax()` directly; `brzycki1RM` no longer exists.)*

**3. Persist confirmed maxes**

Extend `createFirstCycle` (`onboarding/actions.ts`) to accept the confirmed `{ lift, oneRm }[]` and write
them via the existing `PATCH /programs/:program/training-maxes` endpoint before redirecting to `/cycle/1`.
This closes the discard gap so onboarding actually seeds the training maxes it collects.

## Acceptance Criteria

- [ ] "Enter Lifts" supports adding and removing lift rows; any catalog or custom lift is selectable
- [ ] The three big lifts remain the default rows for a zero-config user
- [ ] Confirmed maxes are persisted to training maxes on completion (the discard gap is closed)
- [ ] Estimation continues to use the Brzycki path; rep-range guidance is unchanged
- [ ] Web test coverage per the "new frontend feature" rule (Playwright once
      [#259](https://github.com/brownm09/lifting-logbook/issues/259) lands; until then a written test plan
      in the PR body)

## Out of Scope

- Mobile onboarding — `apps/mobile` is a "coming soon" placeholder
- Test-week max discovery — shipped in [#129](https://github.com/brownm09/lifting-logbook/issues/129)
- Automatic re-estimation of maxes from logged workout sets after onboarding

## Open Questions

- Should custom-lift selection hard-block onboarding until the [custom-lifts](2026-06-03-custom-lifts.md)
  work lands, or should onboarding ship catalog-only first and gain custom lifts when that dependency
  merges? Recommended: ship catalog-only selection first if the dependency slips.

## References

- [Brzycki, M. (1993). "Strength Testing—Predicting a One-Rep Max from Reps-to-Fatigue." *JOPERD* 64(1):88–90.](https://www.tandfonline.com/doi/abs/10.1080/07303084.1993.10606684) —
  the estimation formula used on the Enter Lifts / Confirm steps
- [Initial Training Max Discovery proposal](2026-04-30-initial-training-max-discovery.md) — the
  `estimateTrainingMax` core utility this flow mirrors
- [Custom User-Created Lifts proposal](2026-06-03-custom-lifts.md) — dependency for custom-lift selection
- [Next.js — Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) —
  the `createFirstCycle` Server Action extended to persist maxes

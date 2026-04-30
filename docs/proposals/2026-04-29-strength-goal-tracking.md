# Proposal: Strength Goal Tracking

**Status:** `draft`
**Date:** 2026-04-29
**Issue:** [#111](https://github.com/brownm09/lifting-logbook/issues/111)

---

## Problem

Lifters following a long-term strength program need a way to know where they stand relative to
established strength standards and whether they are on track to reach their personal milestones.
Without this, progress is measured only session-to-session — there is no medium- or long-term
reference point. The user currently maintains this in a spreadsheet, mapping training maxes against
bodyweight-relative tier thresholds (intermediate / advanced / elite) with manually tracked target
and observed dates. The application has no representation of strength goals as a domain concept,
making it impossible to surface progress in the UI or factor goal tier into cycle planning.

## Proposed Solution

Introduce a `StrengthGoal` domain model in `packages/types` and a system-default standard catalog
in `packages/core` covering the five primary tracked lifts (squat, bench press, weighted chin-up,
deadlift, overhead press). Each goal is scoped to a specific lift and tier, carries an optional
user-override multiplier, and records both a `targetDate` (when the user hopes to achieve it) and
an `observedDate` (when the tier was actually reached). A utility function computes whether a
given training max has cleared a tier threshold and returns a progress ratio for display. System
defaults use bodyweight multipliers derived from the Kilgore/Rippetoe standards; users can
override any threshold for any lift.

## Acceptance Criteria

- [ ] `packages/types` exports `StrengthTier` (`'intermediate' | 'advanced' | 'elite'`),
      `StrengthStandard` (`liftId`, `tier`, `multiplier`), and `StrengthGoal`
      (`userId`, `liftId`, `tier`, `multiplierOverride?`, `targetDate?`, `observedDate?`)
- [ ] `packages/core` exports system-default standards for all five lifts with the following
      bodyweight multipliers:

      | Lift       | Intermediate | Advanced | Elite |
      |------------|:---:|:---:|:---:|
      | Squat      | 1.6× | 2.0× | 2.4× |
      | Bench      | 1.2× | 1.5× | 1.8× |
      | Chin-up    | 1.2× | 1.5× | 1.8× |
      | Deadlift   | 2.0× | 2.5× | 3.0× |
      | OH Press   | 0.75× | 1.0× | 1.25× |

- [ ] `packages/core` exports `evaluateStrengthTier(trainingMax, bodyweight, multiplier)`
      returning `{ achieved: boolean; progressRatio: number }`
- [ ] Chin-up evaluation uses total weight (bodyweight + added weight), consistent with the
      existing `calculateAddedWeight` utility in `packages/core`
- [ ] `StrengthGoal.multiplierOverride` supersedes the system standard when present
- [ ] Strict TypeScript compilation passes in `packages/types` and `packages/core`
- [ ] Unit tests cover: tier evaluation (achieved/not achieved), progress ratio calculation,
      multiplier override, and all five default lift standards

## Out of Scope

- UI for viewing or editing strength goals (follows in a future proposal)
- Cycle planning integration — noted as a future connection; the data model is designed to
  support it but this proposal ships the domain layer only
- Custom lifts outside the existing exercise catalog
- Weight unit conversion (lbs throughout; kg support is a separate concern)
- Automatic detection of tier achievement (no event-driven observation; `observedDate` is
  set by the user or a future background process)

## Open Questions

**Cycle planning integration:** When a user's training goal is "strength" (as opposed to sport
performance or physique), the active strength goals should factor into cycle recommendations —
for instance, prioritizing the lift furthest from its next tier threshold, or adjusting volume
and intensity targets accordingly. The `StrengthGoal` model is intentionally designed to support
this query, but the integration point with the ADR-016 cycle planning agent is deferred. A brief
design note should be added to the cycle planning work stream before v0.3 implementation begins.

## References

- [Kilgore, Lon & Rippetoe, Mark — *Starting Strength*, 3rd ed.](https://aasgaardco.com/store/books-posters-dvd/books/starting-strength-basic-barbell-training/) —
  primary source for the bodyweight-relative strength standards used as system defaults
- [ADR-016 — Cycle Planning Agent](../adr/) — LLM integration design that future strength-goal
  integration will build on
- [`packages/core/src/bodyweight.ts`](../../packages/core/src/bodyweight.ts) —
  `calculateAddedWeight` utility; `evaluateStrengthTier` will live alongside it

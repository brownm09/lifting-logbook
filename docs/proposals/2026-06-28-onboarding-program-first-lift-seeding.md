# Proposal: Program-First Onboarding with Auto-Seeded Lifts

**Status:** `shipped`
**Date:** 2026-06-28
**Issue:** [#599](https://github.com/brownm09/lifting-logbook/issues/599)

---

## Problem

The onboarding wizard (`apps/web/app/(authed)/onboarding/`) currently runs in the order **Choose Method → Enter Lifts → Confirm Maxes → Choose Program** (`STEP_LABELS` in `OnboardingFlow.tsx`). The lifts step therefore renders before the user has told us anything about the program they intend to run. We seed the lifts panel with a fixed `DEFAULT_LIFTS` list that is the same for everyone, regardless of whether they are about to start 5/3/1 (four main lifts), Leangains (twelve lifts across three days), or RPT. The user is asked to curate that list — adding and removing rows via the lift picker — with no signal about which lifts the program they have not yet chosen actually uses.

This is backwards relative to the primary persona's job-to-be-done. The Consistent Intermediate Lifter follows a *structured program* and expects the app to handle the mechanics; making them hand-assemble a lift list before they have even named the program inverts that expectation. It also produces avoidable rework: a user who carefully fills in weights for the default lifts on the Enter Lifts step may reach Choose Program two steps later, pick Leangains, and discover their training maxes do not cover the lifts that program needs.

Crucially, the data to do better already exists. `packages/core` exports `PRESET_BASE_SPECS` — a `Record<string, LiftingProgramSpec[]>` keyed by program ID, where each program's value is the ordered array of per-lift, per-week spec rows that drives cycle generation. The deduplicated, order-preserving lift list for a program is recoverable from that array exactly as `detectPresetSuperset` already does it: `[...new Set(spec.map((row) => row.lift))]`. Independently, `apps/web/lib/programs.ts` already declares a human-facing `lifts: string[]` on every `Program` in the `PROGRAMS` catalog (rendered today as the "Core Lifts" chips in the program detail view). We have the canonical lift list for each program in two places and use it for neither when seeding onboarding.

The fix is to reorder the wizard so program selection comes *before* lift entry, then use the chosen program's canonical lift list to pre-populate the lifts panel. Instead of a generic blank-ish form, the user sees the exact lifts their program uses, in order, ready to receive weights.

## Proposed Solution

1. **Reorder the wizard steps** in `OnboardingFlow.tsx` from `Choose Method → Enter Lifts → Confirm Maxes → Choose Program` to **`Choose Method → Choose Program → Enter Lifts → Confirm Maxes`**. This requires updating, in lockstep:
   - `STEP_LABELS` and the `Step {step + 1} of {STEP_LABELS.length}` header.
   - The `step === N` render switch in the `<section className={styles.body}>` block (`StepMethod` → `StepProgram` → `StepLifts`/`StepImport` → `StepConfirm`).
   - The advance gating in `goNext`/the action row: the `canAdvanceFromLifts` gate currently keyed to `step === 1` must follow the lifts step to its new index, and a "program selected" gate must guard advancing off the new program step.
   - The hardcoded `'Continue to Programs'` button label (now obsolete) and the `step < 3` / `step > 0 && step < 3` action-row conditionals.

2. **Move the cycle-creation submit action to the final step.** Today the terminal "Choose This Program" button lives inside `StepProgram` and calls `handleConfirm` → `createFirstCycle(selectedProgramId, maxes)`. With program selection no longer last, `StepProgram` becomes a mid-wizard selection step (select-and-advance), and the final confirm/submit action — including `isPending`, `cycleError`, and the `createFirstCycle` call — moves onto `StepConfirm`, which already receives the computed maxes. `StepProgram`'s detail-view "Choose This Program" button becomes "select this program and continue."

3. **Seed the lifts panel from the selected program, only when empty.** When the user advances out of the new program step, derive the program's canonical lift list and, **if and only if the current `lifts` array is empty (`length === 0`)**, replace it with rows for those lifts (`{ lift, weight: '', reps: '' }`). If the user has already added their own lifts, leave their list untouched. `addLift` already de-duplicates by lift name, so seeding can reuse the same merge discipline. The seed must preserve the program's lift order. `DEFAULT_LIFTS` is retired as the wizard's initial state under this reorder: the `lifts` array starts empty on mount, so the first time the user advances off the program step the panel is always empty and seeding fires unconditionally. This eliminates the need to distinguish "empty" from "untouched default."

4. **Choose a single lift source and document the choice.** Two sources exist:
   - `PRESET_BASE_SPECS[programId]` in `packages/core` — authoritative for cycle generation, but currently only defines `leangains` and `5-3-1`. RPT (`rpt`) is **absent** (see Known Dependency / issue #592).
   - `PROGRAMS[programId].lifts` in `apps/web/lib/programs.ts` — a web-only display list that *does* include `rpt` today.

   The brief specifies seeding from `PRESET_BASE_SPECS`. That is the right authoritative source, but it means RPT gets no seed until #592 lands. The wizard must degrade gracefully: when the selected program has no entry in `PRESET_BASE_SPECS`, the lifts panel stays empty and the user adds their own lifts manually; onboarding still completes normally. Whether to *also* fall back to `PROGRAMS[].lifts` for unmapped programs is an open question (see below) — the safe default is to ship the empty/`DEFAULT_LIFTS` fallback and let #592 close the RPT gap.

5. **Preserve the `import` branch.** When `method === 'import'`, lift rows are pre-filled from a training-maxes CSV via `StepImport` → `handleImported`. Program-derived seeding must not clobber an import: the "only when empty" rule already covers this (an import populates `lifts`, so seeding is skipped), but the reorder means the program is now chosen *before* the import happens — confirm the import still overwrites the (possibly seeded) rows as the user's explicit choice, consistent with today's `setLifts(rows)` semantics.

6. **Update tests for the new order and the seeding behaviour.** `OnboardingFlow.test.tsx`, `StepLifts.test.tsx`, and `page.test.tsx` assert step labels, ordering, and gating that this change moves. Add coverage for: (a) selecting a mapped program (5/3/1, Leangains) seeds the expected ordered lift rows; (b) a program with manual lifts already added is **not** overwritten; (c) an unmapped program (RPT, until #592) leaves the panel at the fallback without error; (d) the `import` path is unaffected.

## Acceptance Criteria

- [ ] The onboarding wizard step order is **Choose Method → Choose Program → Enter Lifts → Confirm Maxes**, reflected in `STEP_LABELS`, the progress dots, the step header, and the `step === N` render switch.
- [ ] Selecting a program whose ID is a key in `PRESET_BASE_SPECS` (`5-3-1`, `leangains`) seeds the Enter Lifts panel with that program's canonical lifts, deduplicated and in spec order, **only when the lifts array is empty (`length === 0`)**. `DEFAULT_LIFTS` is not pre-loaded on mount; the `lifts` array starts empty so seeding fires on first program selection without special-casing.
- [ ] If the user has already added one or more lifts manually before the program is (re)selected, their list is **not** overwritten.
- [ ] Selecting a program with **no** `PRESET_BASE_SPECS` entry (e.g. `rpt` until #592) does not error: the lifts panel stays empty and the user adds lifts manually; onboarding completes normally.
- [ ] The cycle-creation submit (`createFirstCycle`, with `isPending` / `cycleError` handling) fires from the final Confirm step, not from program selection; `StepProgram`'s selection action advances the wizard rather than submitting.
- [ ] The `method === 'import'` path still pre-fills lifts from the CSV and is not overwritten by program-derived seeding.
- [ ] Advance gating is correct under the new order: the user cannot leave the program step without a selection, and cannot leave the lifts step until every lift row satisfies `canAdvanceFromLifts`.
- [ ] Tests in `OnboardingFlow.test.tsx` / `StepLifts.test.tsx` / `page.test.tsx` are updated for the new order and cover the four seeding cases (mapped-seeds, manual-preserved, unmapped-fallback, import-unaffected).
- [ ] Because this PR changes `apps/web` UI strings/structure, the Playwright E2E suite is run locally (`npm run test:e2e -w @lifting-logbook/web`) and passes, per the project `## Testing` rules.

## Out of Scope

- Adding `rpt` (or any other program) to `PRESET_BASE_SPECS`. That is issue **#592** and is a `packages/core` change; this proposal depends on it for full RPT coverage but does not implement it.
- Pre-filling **weights/training maxes** from the program. Seeding populates lift *rows* only; the user still enters their own numbers (consistent with J2 — onboarding sets up the training maxes).
- Changing cycle-generation logic, the `LiftingProgramSpec` shape, or how `createFirstCycle` builds the first cycle.
- The mobile onboarding flow (`apps/mobile`), if/when it exists — this proposal targets `apps/web` only.
- Reconciling the two lift-list sources (`PRESET_BASE_SPECS` vs `PROGRAMS[].lifts`) into one. Noted as a follow-up risk, not addressed here.

## Open Questions

- For a program with no `PRESET_BASE_SPECS` entry, should the wizard fall back to that program's `PROGRAMS[].lifts` (which would seed RPT *today*, before #592) instead of the generic `DEFAULT_LIFTS` / empty panel? This trades a faster RPT win against introducing a second seeding source and a subtle inconsistency between display lifts and spec lifts. Recommendation: ship the conservative fallback first; revisit once #592 lands.
- If the user selects a program, advances past Enter Lifts, then goes **Back** and switches to a *different* program, should the lift panel re-seed? The "only when empty" rule means it will *not* re-seed once rows exist — which protects manual edits but can leave the panel showing the first program's lifts. Is an explicit "reset to \<program\> lifts" affordance warranted, or is silent non-overwrite the right call?
- Should the seeded rows be visually marked as program-suggested (vs. manually added) so the user understands where they came from and that they can remove them?
- ~~Does the `DEFAULT_LIFTS` constant still have a role once program-first seeding exists, or should it become purely the unmapped-program fallback?~~ **Resolved:** `DEFAULT_LIFTS` is retired as the wizard's initial state. The `lifts` array starts empty on mount; for unmapped programs the panel simply stays empty and the user adds lifts manually. `DEFAULT_LIFTS` may be removed entirely or kept only as a typed constant for tests.

## References

- `packages/core/src/presets/index.ts` — `PRESET_BASE_SPECS` (`Record<string, LiftingProgramSpec[]>`; `leangains` and `5-3-1` only) and `detectPresetSuperset`, whose `[...new Set(spec.map((row) => row.lift))]` derives the canonical lift list.
- `apps/web/lib/programs.ts` — the `PROGRAMS` catalog and its per-program `lifts: string[]` (the alternate display lift source; includes `rpt`).
- `apps/web/app/(authed)/onboarding/OnboardingFlow.tsx` — wizard orchestration: `STEP_LABELS`, the `step === N` switch, `lifts`/`setLifts` state, `addLift` de-duplication, `handleConfirm` → `createFirstCycle`.
- `apps/web/app/(authed)/onboarding/steps/StepProgram.tsx`, `StepLifts.tsx`, `StepConfirm.tsx`, `StepImport.tsx` — the step components affected by the reorder and submit-move.
- Issue **#592** — `rpt` missing from `PRESET_BASE_SPECS` (blocks RPT auto-seeding; full-coverage dependency).
- `docs/standards/error-fallback-test-coverage.md` — governs the unmapped-program fallback's test coverage (the empty/`DEFAULT_LIFTS` fallback path must be asserted, not silently swallowed).
- Milestone: **v0.3 — Client Applications**; Epic: **Client Applications**.

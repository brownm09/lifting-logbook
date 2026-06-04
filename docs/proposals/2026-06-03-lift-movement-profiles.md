# Proposal: Lift Movement Profiles — Joint Action and Complexity Metadata

**Status:** `shipped`
**Date:** 2026-06-03
**Issue:** [#427](https://github.com/brownm09/lifting-logbook/issues/427)
**Shipped in:** [#437](https://github.com/brownm09/lifting-logbook/pull/437) — full clean-break migration (no deprecated alias); catalog has 23 entries (not 25).

---

## Problem

The `Lift` model (`packages/types/src/domain.ts`) describes a lift along two axes today:

- `classification` (`compound | accessory`) — a training **role** (is this a primary progressive lift or a
  supplemental accessory?)
- `movementTags` (`push | pull | vertical | horizontal | hinge | carry | squat`) — a movement **pattern**

Neither captures the anatomical joint actions a lift trains — internal rotation, external rotation, flexion,
extension, abduction, adduction — nor its movement **complexity** (simple vs compound). Without these, the
app cannot reason about balance across joint actions, surface them in lift detail, or let users describe a
custom lift accurately. These descriptors should be **preconfigured for in-catalog lifts** and **editable
for custom lifts**.

Note the deliberate distinction this proposal must preserve: movement *complexity* (`simple | compound`,
i.e. single-joint vs multi-joint) is **not** the same as the existing `classification` (`compound |
accessory`, a training role). A Goblet Squat is movement-`compound` but role-`accessory`. Both axes are
kept.

## Proposed Solution

Per the chosen modeling approach, fold pattern, joint action, and complexity into a **single combined
movement-profile structure** rather than scattering independent fields across the model.

**1. New combined structure** (`packages/types/src/domain.ts`)

```ts
export type JointAction =
  | 'flexion' | 'extension'
  | 'internal-rotation' | 'external-rotation'
  | 'abduction' | 'adduction';

export type MovementComplexity = 'simple' | 'compound';

export interface MovementProfile {
  patterns: MovementTag[];        // existing push/pull/vertical/... preserved here
  jointActions: JointAction[];    // new anatomical axis
  complexity: MovementComplexity; // new simple/compound axis
}
```

Extend `Lift` with `movementProfile: MovementProfile`. The existing `movementTags` data migrates into
`movementProfile.patterns`. **Decision (shipped):** every call site was migrated in the same PR — `movementTags`
was removed entirely with no deprecated alias (custom lifts shipped the same day in #429, so there was no
production data at risk). `classification` (`compound | accessory`) is retained unchanged as the training-role
axis; the proposal text states the role-vs-complexity distinction explicitly.

**2. Preconfigure the catalog** (`packages/core/src/catalog/lifts.ts`)

Give all 23 catalog entries a sensible `movementProfile`. Examples:

- **Back Squat** → patterns `['squat']`, jointActions `['flexion', 'extension']`, complexity `compound`
- **Face Pull** → patterns `['pull', 'horizontal']`, jointActions `['external-rotation']`, complexity `simple`
- **Cable Curl** → patterns `['pull']`, jointActions `['flexion']`, complexity `simple`

**3. Editable for custom lifts**

The custom-lift create/edit form and `POST/PATCH /lifts/custom` (per the
[custom-lifts proposal](2026-06-03-custom-lifts.md)) accept a `movementProfile`. For catalog lifts the
profile is a read-only default the user can view.

## Acceptance Criteria

- [x] `JointAction`, `MovementComplexity`, and `MovementProfile` exported from `packages/types`
- [x] `Lift.movementProfile` added; existing `movementTags` data preserved under `.patterns`
- [x] All 23 catalog entries carry a preconfigured `movementProfile`; `packages/core` unit tests assert each
- [x] Custom-lift create/edit accepts and persists a `movementProfile` (depends on the custom-lifts work)
- [ ] The role-vs-complexity distinction (`classification` vs `complexity`) is documented in the type's doc comment
- [ ] Strict TypeScript compilation passes across `packages/types`, `packages/core`, and updated call sites

## Out of Scope

- Volume or analytics aggregation by joint action
- A movement-pattern browse / filter UI
- Auto-inferring a movement profile from a lift's name

## Open Questions

- Should `jointActions` be required (non-empty) for every lift, or allowed empty for lifts where it is not
  meaningful (e.g. a loaded carry)? Initial answer: allow empty, mirroring how Calf Raise carries no
  movement tags today.

## References

- [Cardinal planes & anatomical movement terms — joint actions (flexion/extension, rotation, abduction/adduction)](https://www.ncbi.nlm.nih.gov/books/NBK557555/) —
  primary anatomical reference for the `JointAction` taxonomy
- [Lift Library and Exercise Tagging proposal](2026-04-13-lift-library-exercise-tagging.md) — the
  `classification` + `movementTags` model this proposal extends
- [Custom User-Created Lifts proposal](2026-06-03-custom-lifts.md) — dependency for the editable-for-custom half

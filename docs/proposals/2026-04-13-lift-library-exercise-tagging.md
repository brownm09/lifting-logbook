# Proposal: Lift Library and Exercise Tagging

**Status:** `draft`
**Date:** 2026-04-13
**Issue:** [#64](https://github.com/brownm09/lifting-logbook/issues/64)

---

## Problem

The current implementation references lifts as raw strings and hard-codes a fixed set of
exercises tied to the 5/3/1 program structure in `packages/core`. There is no domain model
for an exercise as a first-class object — no compound/accessory classification, no movement
pattern metadata, and no mechanism to configure which exercises fill a program's slots. This
prevents the application from supporting programs other than 5/3/1 and makes it impossible
to represent a user's actual training configuration or apply progression rules to exercises
outside the hard-coded set.

## Proposed Solution

Introduce a `Lift` domain type in `packages/types` and a curated seed catalog in
`packages/core` covering the most common barbell, dumbbell, and bodyweight movements.
Each lift carries two metadata axes: a `classification` (compound | accessory) and one or
more `movementTags` (push | pull | vertical | horizontal | hinge | carry). Extend program
configuration to accept exercise slot → Lift mappings rather than hard-coded names, so any
structured program template can be wired to any exercise in the catalog. The existing 5/3/1
and RPT configurations remain unchanged — they resolve to catalog entries automatically.

## Acceptance Criteria

- [ ] `packages/types` exports a `Lift` interface with `id`, `name`,
      `classification: 'compound' | 'accessory'`, and
      `movementTags: Array<'push' | 'pull' | 'vertical' | 'horizontal' | 'hinge' | 'carry'>`
- [ ] `packages/core` exports a seeded catalog of ≥ 20 lifts covering the major movement
      patterns (squat, hinge, vertical push, vertical pull, horizontal push, horizontal pull,
      carry, and common accessories)
- [ ] Program configuration accepts exercise slot → `Lift` id mappings; existing 5/3/1 and
      RPT slot names resolve to catalog entries without requiring changes to existing call sites
- [ ] `packages/core` unit tests cover: correct classification and tags for each catalog entry;
      slot resolution with a valid catalog lift; slot resolution error when lift id is unknown
- [ ] `packages/types` and `packages/core` strict TypeScript compilation passes with no errors

## Out of Scope

- User-created custom exercises (see Open Questions)
- Exercise search, filtering, or browse UI
- Per-exercise volume analytics or history aggregation
- Video demonstrations, form cues, or coaching content
- Deload or missed-session recovery logic (separate PRD non-goal)

## Open Questions

Should users be able to add custom exercises to their personal library, beyond the seeded
catalog? Both a fixed catalog (simpler, no ownership model) and a user-extensible library
(more flexible, requires persistence and auth boundary decisions) are viable. This proposal
ships the fixed catalog and intentionally leaves the `Lift` model open for a user-ownership
extension. A brief spike to evaluate the persistence and ownership boundary is recommended
before v0.3 client work begins.

## References

- [packages/core — current lift implementation](../../packages/core) — baseline to understand
  existing hard-coded exercise references
- ADR-001 through ADR-012 in `docs/adr/` — hexagonal architecture constraints that govern
  where catalog data lives (core, not infrastructure)
- [Cockburn, Alistair — "Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/) —
  authoritative source for the ports-and-adapters boundary that determines `packages/core`
  must have zero infrastructure dependencies (catalog must be pure data, no DB seed scripts
  in core)

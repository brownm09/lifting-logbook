# Proposal: Custom User-Created Lifts

**Status:** `draft`
**Date:** 2026-06-03
**Issue:** [#425](https://github.com/brownm09/lifting-logbook/issues/425)

---

## Problem

Lifts are referenced throughout the domain as plain strings (`LiftRecord.lift`, `TrainingMax.lift`,
and `LiftMetadata.lift` are all unconstrained `String` columns), and the exercise catalog is a fixed,
in-code array of 25 movements in `packages/core/src/catalog/lifts.ts` with zero persistence. A user who
trains a movement the catalog does not contain — a machine variation, a specialty bar lift, a sport-specific
accessory — has no first-class way to add it. They can type an arbitrary string into a lift-record field,
but that lift carries no classification, no movement metadata, and no identity the rest of the system
recognizes.

This gap blocks two planned features that both need a user-owned lift entity to attach to:

- **Onboarding for any lift** ([onboarding any-lift max estimation](2026-06-03-onboarding-any-lift-max-estimation.md))
  needs to offer custom lifts alongside catalog lifts when seeding initial maxes.
- **Movement profiles** ([lift movement profiles](2026-06-03-lift-movement-profiles.md)) needs custom lifts
  to carry editable joint-action and complexity metadata, since catalog values are read-only.

The [original lift-library proposal](2026-04-13-lift-library-exercise-tagging.md) explicitly left
user-created exercises out of scope and flagged the persistence/ownership boundary as a spike to resolve
before client work. This proposal is that resolution.

## Proposed Solution

Introduce custom lifts as a per-user persisted entity that resolves transparently alongside the built-in
catalog, preserving the hexagonal boundary (ADR-002): catalog data stays pure in `packages/core`, and
custom-lift persistence lives entirely in the API adapter layer.

**1. Types** (`packages/types/src/domain.ts`)

Add a `CustomLift` shape that extends the existing `Lift` fields with ownership, and add an `isCustom?`
discriminator to the base `Lift` (catalog entries are implicitly `false`):

```ts
export interface CustomLift extends Lift {
  userId: string;
  isCustom: true;
  createdAt: Date;
}
```

**2. Persistence** (`apps/api/prisma/schema.prisma`)

Add a `CustomLift` model following the per-user isolation pattern already established by `LiftMetadata`,
`TrainingMax`, and `StrengthGoal`:

```prisma
model CustomLift {
  id             String   @id @default(uuid())
  userId         String
  name           String
  classification String
  // movement metadata persisted per the movement-profile proposal
  createdAt      DateTime @default(now())

  @@unique([userId, name])
  @@index([userId])
  @@map("custom_lift")
}
```

**3. Port + adapters**

Add an `ICustomLiftRepository` port (`apps/api/src/ports/`) with in-memory and Prisma adapters, wired
through the existing `IRepositoryFactory.forUser(...)` per-user factory (the pattern introduced in
[#144](https://github.com/brownm09/lifting-logbook/issues/144)).

**4. Resolution**

Extend `resolveLift` (`packages/core/src/catalog/resolve.ts`) so that a user's custom catalog is consulted
**before** the built-in `LIFT_CATALOG`. Core stays pure: custom lifts are passed in as a data argument by
the API layer — no database access leaks into `packages/core`.

**5. API**

Add `GET/POST/PATCH/DELETE /lifts/custom`, returning the same `Lift`-shaped contract the catalog already
uses, so existing lift-consuming UI (the manage-lifts type-ahead, the lift-metadata editor) works against
custom lifts without modification.

## Acceptance Criteria

- [ ] `CustomLift` type exported from `packages/types`; `Lift.isCustom?: boolean` added
- [ ] `CustomLift` Prisma model + migration, unique per `(userId, name)`
- [ ] `ICustomLiftRepository` port with in-memory and Prisma adapters, threaded through the per-user factory
- [ ] `resolveLift` prefers a user's custom lifts over the built-in catalog; an unknown id still errors
- [ ] `GET/POST/PATCH/DELETE /lifts/custom` with in-memory E2E coverage (per Testing → Coverage Requirements)
- [ ] Ownership isolation: user A cannot read or mutate user B's custom lifts (auth-guard E2E)
- [ ] Strict TypeScript compilation passes across `packages/types`, `packages/core`, and `apps/api`

## Out of Scope

- Sharing or copying custom lifts between users
- Admin curation, moderation, or promoting a custom lift into the global catalog
- Movement-profile metadata shape itself (defined in the [movement-profiles proposal](2026-06-03-lift-movement-profiles.md);
  this proposal persists whatever shape that one lands)
- Deduplication / fuzzy-matching a custom lift against an existing catalog lift

## Open Questions

- Should a custom lift whose name later collides with a newly added catalog entry be reconciled, or continue
  to shadow the catalog entry for that user? Initial answer: continue to shadow (user intent wins); revisit
  if it causes confusion.

## References

- [ADR-002 — Ports and Adapters (Hexagonal Architecture)](../adr/ADR-002-ports-and-adapters.md) —
  governs why catalog data must stay pure in `packages/core` and persistence lives in the adapter layer
- [Cockburn, Alistair — "Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/) —
  authoritative source for the ports-and-adapters boundary
- [Prisma — Data model / relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) —
  per-user model and unique-constraint patterns used by `LiftMetadata`, `TrainingMax`, `StrengthGoal`
- [Lift Library and Exercise Tagging proposal](2026-04-13-lift-library-exercise-tagging.md) — the open
  question this proposal resolves

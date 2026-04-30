# Lifting Logbook — Roadmap

Lifting Logbook is a personal strength training tracker replacing a Google Apps Script /
Google Sheets implementation with a cloud-native web and mobile product. See [`docs/PRD.md`](docs/PRD.md)
for the full product definition.

**This is a human-curated editorial view.** It does not auto-sync from GitHub. New features
are proposed via `/propose`, which creates the proposal doc, the GitHub issue, and the entry
below. Status is updated manually as work progresses.

---

## v0.1 — Foundation `[Shipped]`

Monorepo scaffolding, port interfaces, shared types, and CI/CD. The goal is a working
skeleton where every app and package is wired together and the core hexagonal architecture
is codified.

### Shipped

| Work stream | Description | Issues |
|---|---|---|
| App scaffolding | Scaffold `apps/web` (Next.js App Router) and `apps/mobile` (Expo) | [#9](https://github.com/brownm09/lifting-logbook/issues/9), [#10](https://github.com/brownm09/lifting-logbook/issues/10) |
| Port interfaces | Define `IAuthProvider`, data repository ports, and `IRepositoryFactory` | [#11](https://github.com/brownm09/lifting-logbook/issues/11), [#12](https://github.com/brownm09/lifting-logbook/issues/12), [#13](https://github.com/brownm09/lifting-logbook/issues/13) |
| Shared types | Domain types and API contract types in `packages/types` | [#14](https://github.com/brownm09/lifting-logbook/issues/14), [#15](https://github.com/brownm09/lifting-logbook/issues/15) |
| CI/CD foundation | Lint and test on PR; Docker build and push on merge to main | [#16](https://github.com/brownm09/lifting-logbook/issues/16), [#17](https://github.com/brownm09/lifting-logbook/issues/17) |
| Process infrastructure | ROADMAP and `docs/proposals/` convention | [#58](https://github.com/brownm09/lifting-logbook/issues/58) |

### Proposals

| Proposal | Description | Issue |
|---|---|---|
| *(none yet)* | | |

---

## v0.2 — Core API `[Shipped]`

A working REST + GraphQL API backed by real adapters. Core module quality gates enforced.
Architecture decisions for data access and security documented.

### Active Work

| Work stream | Description | Issues |
|---|---|---|
| *(all shipped)* | | |

### Shipped

| Work stream | Description | Issues |
|---|---|---|
| Architecture documentation | ADR-014 credential encryption; cache invalidation strategy; Express legacy archival policy | [#38](https://github.com/brownm09/lifting-logbook/issues/38), [#39](https://github.com/brownm09/lifting-logbook/issues/39), [#42](https://github.com/brownm09/lifting-logbook/issues/42) |
| Core module cleanup | Enable strict TypeScript; remove GAS Logger dependency | [#51](https://github.com/brownm09/lifting-logbook/issues/51), [#52](https://github.com/brownm09/lifting-logbook/issues/52) |
| ADR-015 | GraphQL DataLoader design: scope, batching, and request isolation | [#40](https://github.com/brownm09/lifting-logbook/issues/40) |
| ADR-016 | Cycle planning agent: LLM integration, tool schema, and adapter boundary | [#55](https://github.com/brownm09/lifting-logbook/issues/55) |

### Proposals

| Proposal | Description | Issue | Status |
|---|---|---|---|
| [Lift Library and Exercise Tagging](docs/proposals/2026-04-13-lift-library-exercise-tagging.md) | First-class `Lift` domain type with compound/accessory classification, movement tags, and configurable program exercise slots | [#64](https://github.com/brownm09/lifting-logbook/issues/64) | shipped |

---

## v0.3 — Client Applications `[Current]`

Web and mobile clients functional end-to-end. Key user-facing features implemented.

### Active Work

| Work stream | Description | Issues |
|---|---|---|
| Cycle planning — implementation | LLM-powered training cycle recommendations, using design from ADR-016 | [#54](https://github.com/brownm09/lifting-logbook/issues/54) |
| A/B comparison documentation | Define exit criteria and CI event taxonomy enforcement for Express/NestJS comparison | [#41](https://github.com/brownm09/lifting-logbook/issues/41) |

### Shipped

| Work stream | Description | Issues |
|---|---|---|
| Bodyweight exercise tracking | Domain/core layer: `BodyWeightEntry` type, `isBodyweightComponent` flag, catalog metadata, `calculateAddedWeight` utility | [#29](https://github.com/brownm09/lifting-logbook/issues/29) |
| Mobile dependency wiring | `@logbook/types` already declared in `apps/mobile/package.json`; hoisted by npm workspaces — no code change needed | [#50](https://github.com/brownm09/lifting-logbook/issues/50) |
| Cycle Dashboard Screen | `/cycle` and `/cycle/:cycleNum` — week grid, planned weights, completion status; `tsc-alias` fix for Turbopack | [#104](https://github.com/brownm09/lifting-logbook/issues/104) |

### Proposals

| Proposal | Description | Issue |
|---|---|---|
| [Workout Logging Screen](docs/proposals/2026-04-29-workout-logging-screen.md) | Per-exercise logging with warm-ups, bodyweight gate, and whole-workout overview toggle | [#106](https://github.com/brownm09/lifting-logbook/issues/106) |
| [Training Max Management Screen](docs/proposals/2026-04-29-training-max-management.md) | View and edit per-lift 1RMs at `/settings/training-maxes`; drives all working set calculations | [#108](https://github.com/brownm09/lifting-logbook/issues/108) |
| Configurable week grouping | Remove `WeekNumber = 1\|2\|3\|4` type constraint and `MAX_WORKOUT_NUM = 8` API limit; source week from program spec | [#116](https://github.com/brownm09/lifting-logbook/issues/116) |

---

## Maintenance

- **Adding an item:** run `/propose <idea>` — it creates the proposal doc, the GitHub issue,
  and the entry in the appropriate milestone section above.
- **Updating status:** edit this file directly when work starts, completes, or is deferred.
  No special workflow required for status changes.
- **Milestone scope changes:** material changes (moving items between milestones, dropping
  items) follow the same PR process as `docs/PRD.md` material changes — explicit statement
  of what changed and why.

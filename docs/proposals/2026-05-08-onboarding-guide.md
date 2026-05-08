# Proposal: Developer Onboarding Guide

**Status:** `draft`
**Date:** 2026-05-08
**Issue:** [#200](https://github.com/brownm09/lifting-logbook/issues/200)

---

## Problem

Onboarding material is scattered across [README.md](../../README.md),
[CONTRIBUTING.md](../../CONTRIBUTING.md), [docs/README.md](../README.md), and
[docs/deploy.md](../deploy.md). A new engineer has to know to look in all four files to
piece together a working mental model. There is no single document that walks them from
clone to first PR — and as the repo grows, the gap will widen rather than close.

## Proposed Solution

Add `docs/onboarding.md` as the canonical "day one" entry point. It does not duplicate
content — it sequences the existing docs and fills the gaps between them. The guide
covers: prerequisites, repo clone and bootstrap, the architecture mental model (linking
to the right ADRs in reading order), how to run apps locally, how to run tests, how to
debug the API and the web app, the standard issue workflow, and where to look when stuck.
The README's quick-start gets a one-line "for a guided walkthrough, see [onboarding.md]".

## Acceptance Criteria

- [ ] `docs/onboarding.md` exists and follows a "clone → first PR" narrative
- [ ] It links to (does not duplicate) README, CONTRIBUTING, docs/README, docs/deploy, and the relevant ADRs
- [ ] An "ADR reading order" section recommends the first 4–5 ADRs for new engineers
- [ ] A troubleshooting section covers the top three local-dev failure modes (env vars missing, Postgres not up, Node version mismatch)
- [ ] [README.md](../../README.md) links to `docs/onboarding.md` from its quick-start section

**Post-merge follow-up (not part of the implementing PR's done-line):**

- Observe the next new-engineer onboarding pass after this guide ships and revise gaps surfaced during that pass

## Out of Scope

- Production deployment walkthrough — already covered by [docs/deploy.md](../deploy.md)
- Architecture deep-dive — already covered by [docs/README.md](../README.md) and the ADR corpus
- Mobile-specific onboarding — defer until `apps/mobile` has more substance
- Video walkthroughs

## References

- [GitLab Handbook — Engineering Onboarding](https://handbook.gitlab.com/handbook/engineering/) — reference for the "narrative onboarding doc" pattern in a public engineering org
- [Will Larson — Onboarding new engineers](https://lethain.com/onboarding-engineers/) — the framing this proposal follows: orient → observe → contribute

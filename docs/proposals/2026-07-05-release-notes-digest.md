# Proposal: On-Demand Release Notes Digest

**Status:** `draft`
**Date:** 2026-07-05
**Issue:** [#723](https://github.com/merickvaughn/lifting-logbook/issues/723)

---

## Problem

The repo has no human-readable record of what changed between one deployable state and the next. There is no `CHANGELOG.md`, no GitHub Releases in active use (a single unrelated legacy tag is the only ref that exists), and none of the usual release tooling — semantic-release, changesets, conventional-commits — is installed. A user or contributor who wants to know "what's new since last week" has nowhere to look. They can read the raw commit log, but that is a firehose of ~410 squash commits with no grouping, no versioning, and no summary of user-facing impact.

This gap is newly conspicuous because the deployment-identity story just got better without the change-history story following it. PR #686 added `GET /version` endpoints to both apps — `apps/api/src/health/health.controller.ts` and `apps/web/app/version/route.ts` — each returning `{ gitSha, environment }`. We can now answer "*which* build is running in staging" precisely, but not "what does that build actually contain that the last one didn't." Deployment identity without a changelog tells you the commit you're on and nothing about the journey to it.

The frustrating part is that the raw material for release notes already exists and is already disciplined. This repo's CLAUDE.md "Commit Message Format" section mandates a `[<type>] <imperative description>` subject plus a `Closes #<N>` line in the body on every commit, and squash-merge means every merged PR collapses to exactly one such commit on `main`. Real history uses the documented types (`feat`, `fix`, `chore`, `docs`, `infra`, `test`, `refactor`) plus two rarer ones seen in practice (`ops`, `security`), and the `Closes #N` reference ties each line back to an issue. That is structured, parseable metadata sitting in the commit log today. Generating a readable changelog from it requires no change to how anyone commits — it only requires a tool that reads what is already there.

Versioning should follow the roadmap the project already keeps rather than introducing a second scheme. `ROADMAP.md` organizes work into milestones and tags the active one `[Current]` (currently `v0.3 — Client Applications`). A release cut under that milestone is naturally `v0.3.1`, `v0.3.2`, and so on — milestone-anchored, not calendar-based and not tied to the workspace `package.json` "version" fields (which are dormant `0.0.0` placeholders and deliberately stay that way). The trigger should be a human decision, not CI: someone decides the moment is right to cut a release and runs a script. Automating the cut would mean a bot committing to `main`, which collides head-on with this repo's standing "never commit directly to `main`" rule.

## Proposed Solution

This is a multi-PR initiative decomposed into three sub-issues. The detailed implementation design is in the companion doc [`2026-07-05-release-notes-digest-design.md`](2026-07-05-release-notes-digest-design.md); this proposal covers scope and rationale at PRD altitude and defers implementation specifics (exact parsing logic, section ordering, edge cases) to that doc.

1. **Generator script + seeded `CHANGELOG.md` + ADR (sub-issue A).** Add a Node script `scripts/generate-release-notes.mjs` that collects commits merged since the last release and renders them into a [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)-format entry prepended to a running `CHANGELOG.md` at the repo root. "Since the last release" is tracked by a self-describing HTML-comment marker written into `CHANGELOG.md` itself, not by a git tag — the repo's one existing tag is an unrelated legacy artifact, and requiring a synchronized `git tag` step would reintroduce exactly the kind of two-artifacts-can-drift problem this design is trying to avoid. The script maps commit types onto Keep a Changelog's vocabulary — `feat` → `Added`, `fix` → `Fixed` — and collapses every other type into a trailing `Internal` section where each line is tagged with its original type (`chore`, `docs`, `infra`, `test`, `refactor`, `ops`, `security`), so contributors keep full visibility of everything that shipped without needing a second artifact. The version number is derived automatically by reading the `[Current]`-tagged milestone from `ROADMAP.md`, with a manual override flag. The first run seeds `CHANGELOG.md` with a short retroactive baseline entry rather than backfilling ~410 commits of pre-existing history. The PR also adds `docs/adr/ADR-032` (the next free ADR number — `ADR-029` is currently the highest) recording this whole approach as a decision record, and a `docs/release-process.md` runbook documenting the manual follow-up: after the CHANGELOG PR merges, a person tags the release and runs `gh release create`, with a Release body sliced verbatim from the corresponding `CHANGELOG.md` section so the two stay byte-identical.

2. **`/whats-new` website page (sub-issue B).** Add a Next.js Server Component at `apps/web/app/(authed)/whats-new/page.tsx` that reads the bundled `CHANGELOG.md` directly from the filesystem at request time and renders it. Reading the file from the image — rather than calling the GitHub API live — avoids taking on a new runtime dependency on GitHub's availability and rate limits, and guarantees the page always shows exactly what shipped in the running image. Parsing is done by a small hand-written parser rather than a markdown-rendering dependency, since the file's shape is fully under our control. A nav entry is added to `apps/web/app/(authed)/AppNav.tsx`. This sub-issue also requires a one-line fix to `apps/web/Dockerfile`: the production image's runner stage does not currently copy `CHANGELOG.md` into the image at all (confirmed by direct inspection), so without the fix the page would 404/500 in production even though it works in local dev. Pagination/truncation of older releases is deliberately **not** built in this sub-issue — see Open Questions.

3. **Non-blocking staleness nag (sub-issue C).** A new scheduled GitHub Actions workflow, `.github/workflows/release-notes-staleness-check.yml` (mirroring the cron-based precedent of `.github/workflows/merge-ready-digest.yml`), that checks whether more than ~30 days have passed since the most recent `CHANGELOG.md` entry *and* at least one `[feat]`/`[fix]` commit has landed on `main` since that date. If both hold, it posts or updates a sticky advisory comment on the top-level tracking issue reminding that a release is overdue. This is purely advisory: it never fails a check, never blocks a merge, and never commits anything to `main` (same constraint the generator itself respects). Where practical, it reuses the changelog-date-parsing helper from `scripts/generate-release-notes.mjs` rather than reimplementing that parsing a second time. Sequenced after sub-issue A merges (needs `CHANGELOG.md` and the generator's parsing helpers to exist).

## Acceptance Criteria

- [ ] `scripts/generate-release-notes.mjs` exists and, run on-demand, prepends a new Keep a Changelog-format entry to a repo-root `CHANGELOG.md`.
- [ ] The script determines the boundary of "since last release" from a self-describing HTML-comment marker in `CHANGELOG.md`, not from a git tag.
- [ ] `feat` commits render under `Added`, `fix` under `Fixed`, and all other types collapse into a trailing `Internal` section tagged with the original type.
- [ ] The version number is derived from the `[Current]` milestone in `ROADMAP.md`, with a documented manual-override flag.
- [ ] The initial `CHANGELOG.md` contains a short retroactive baseline entry, not a dump of all prior commits.
- [ ] `docs/adr/ADR-032` documents the release-notes approach and includes a `## References` section.
- [ ] `docs/release-process.md` documents the manual tag + `gh release create` follow-up, states the Release body is sliced verbatim from the matching `CHANGELOG.md` section, and states the concrete threshold for promoting the runbook to a wrapper script (after the 3rd manually-cut release, or immediately on a correctness mistake).
- [ ] `apps/web/app/(authed)/whats-new/page.tsx` renders the bundled `CHANGELOG.md` as a Server Component, reading it from the filesystem (no live GitHub API call).
- [ ] A `/whats-new` entry is present in `apps/web/app/(authed)/AppNav.tsx`.
- [ ] `apps/web/Dockerfile` copies `CHANGELOG.md` into the runner stage so the page renders in the production image.
- [ ] `.github/workflows/release-notes-staleness-check.yml` exists, runs on a schedule, and posts a non-blocking advisory comment only when both the 30-day-staleness and qualifying-commit conditions hold.
- [ ] Each sub-issue PR carries the coverage its change type requires (a test for the generator's parse/render logic; a Playwright/test-plan entry for the new web page; a dry-run/manual-trigger check for the staleness workflow).

## Out of Scope

- Bumping or otherwise using the workspace `package.json` "version" fields — they stay dormant `0.0.0` placeholders.
- Adopting semantic-release, changesets, or conventional-commits tooling — the existing commit convention is sufficient input.
- CI-automated release *cutting* (as opposed to the advisory nag in sub-issue C) — automation would require a bot commit to `main`, which conflicts with the repo's "never commit directly to `main`" rule; the trigger stays a manual human decision.
- Reconstructing pre-2022-convention git history into the changelog — the seed is a single retroactive baseline entry instead.
- A folder-of-per-release-files changelog layout — a single running `CHANGELOG.md` was chosen instead.
- Continuous per-PR hand-editing of an `## [Unreleased]` section — deliberately rejected, because it would make `CHANGELOG.md` a merge-conflict hotspot given how many PRs land concurrently in this repo (the same class of problem the engineering journal already solved via per-session file sharding).
- Pagination or truncation on the `/whats-new` page — confirmed as standard practice among comparable products (see Open Questions), but deferred until the file's length actually warrants it.

## Open Questions

- ~~Should the `/whats-new` page paginate or truncate once many releases have accumulated?~~ **Resolved:** checked three real changelog pages directly — Linear (`linear.app/changelog`), GitHub's own changelog (`github.blog/changelog`), and Vercel (`vercel.com/changelog`) — all three paginate via simple page-based navigation ("Older updates" / "Show more" links), none use infinite scroll. Keep a Changelog's own maintainers confirmed in a GitHub discussion (olivierlacan/keep-a-changelog#529) that there's no official standard yet for long changelogs. Confirmed as standard practice, but deferred: this repo's on-demand cadence means far lower volume than these products' near-daily entries for the foreseeable future, and the parser already returns a `ChangelogRelease[]` array, so slicing to "latest N + older-releases link" later is a trivial addition, not a rework.
- ~~Should there eventually be a lightweight CI check that nags but does not block when a PR touching user-facing code merges without a release having been cut in a while?~~ **Resolved:** yes, after roughly a month of qualifying PRs with no release cut — this is now sub-issue C.
- ~~Should the `docs/release-process.md` runbook eventually be promoted to a small wrapper script if running the tag + `gh release create` steps by hand proves annoying across several real releases?~~ **Resolved:** promote after the 3rd release has been cut by hand via the documented runbook — an objective, countable trigger rather than a subjective "annoying" feeling — or immediately, before that count, if a manual step is ever fat-fingered badly enough to produce a bad tag or a mismatched Release body.

## References

- `apps/api/src/health/health.controller.ts` and `apps/web/app/version/route.ts` — the existing `GET /version` endpoints (`{ gitSha, environment }`) added in PR #686; deployment-identity context this proposal complements.
- CLAUDE.md → "Commit Message Format" — the `[<type>] <description>` + `Closes #<N>` convention that is the generator's parseable input.
- `ROADMAP.md` — the milestone scheme (`[Current]`-tagged milestone) that supplies the version number.
- `apps/web/app/(authed)/AppNav.tsx` — the nav component that gains the `/whats-new` entry.
- `apps/web/Dockerfile` — the production image build that must copy `CHANGELOG.md` into the runner stage.
- `.github/workflows/merge-ready-digest.yml` — the existing cron-based digest-to-issue-comment precedent sub-issue C's staleness check mirrors.
- Keep a Changelog v1.1.0 — https://keepachangelog.com/en/1.1.0/ — the output format the generator targets.
- [`2026-07-05-release-notes-digest-design.md`](2026-07-05-release-notes-digest-design.md) — the detailed implementation design this PRD-lite doc defers to (file layout, algorithms, exact output shapes).
- Milestone: **v0.3 — Client Applications**; Epic: **Client Applications**.

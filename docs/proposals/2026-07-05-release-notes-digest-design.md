# Design Notes: On-Demand Release Notes Digest

Companion detail doc for [`2026-07-05-release-notes-digest.md`](2026-07-05-release-notes-digest.md).
That proposal covers scope and rationale at PRD altitude; this document is the concrete
implementation design sub-issues A and B should follow — file layout, algorithms, exact output
shapes, and the reasoning behind each choice. It exists in-repo (rather than only in a local
planning artifact) so the design survives independently of any one session or machine.

---

## Decisions confirmed with the user

1. **Trigger: manual/on-demand.** No CI automation. A person (or Claude Code acting for them)
   decides to cut a release and runs a script.
2. **Source of truth: GitHub Releases + a persisted `CHANGELOG.md`.** The GitHub Release body
   is generated *from* the CHANGELOG.md section, not authored separately — one source, two
   display surfaces.
3. **Shape: a single running `CHANGELOG.md`** at repo root, Keep a Changelog format — new
   dated sections prepended at the top, not a folder of per-release files.

## Additional design decisions (beyond what was explicitly asked, open to pushback at review)

- **Update model: CHANGELOG.md is touched only at release-cut time, never continuously.**
  Confirmed with the user. The generator mechanically derives an entire new dated section from
  `git log` the moment it's run — nothing appends to `## [Unreleased]` as ordinary PRs merge,
  and that section stays empty/vestigial between releases (kept only for Keep a Changelog
  format compliance). This deliberately avoids the classic "every PR hand-adds a bullet to
  Unreleased in the same PR" workflow, which would make CHANGELOG.md a single-file
  merge-conflict hotspot given how many PRs land in this repo concurrently — the same class of
  problem the engineering journal already hit and solved for via per-session file sharding
  (ADR-056 in `brownm09/dev-env`). The trade-off: generated bullet text is exactly the commit's
  imperative-mood summary rather than hand-curated release prose — mitigated by the fact that
  the release-cutting flow already goes through normal PR review, so wording can be polished
  then, just not per-PR.
- **Versioning scheme: milestone-based** (`v0.3.1`, `v0.3.2`, ... — patch increments under
  ROADMAP.md's current milestone; the minor digit only advances when ROADMAP.md's `[Current]`
  tag moves to a new milestone). Rationale: since cutting a release is a deliberate, curated
  act (not tied to every deploy), reusing the exact `v0.1`/`v0.2`/`v0.3` scheme ROADMAP.md
  already maintains keeps one coherent version narrative instead of introducing a second,
  parallel, date-based one. This is independent of and does **not** touch the dormant
  `package.json` `"version": "0.0.0"` fields.
- **Category mapping resolves "users and contributors" structurally, in one file:**
  `feat`→`Added`, `fix`→`Fixed` (Keep a Changelog's own user-facing vocabulary), everything
  else (`chore`/`docs`/`infra`/`test`/`refactor`/any future type) → a trailing `### Internal`
  section, each line prefixed with its original `` `[type]` `` tag. Users read the top of a
  release section; contributors scroll to `Internal` for full visibility. The website page
  renders this unfiltered — no separate curation logic, no second artifact.

## Sub-issue A: Generator script + CHANGELOG.md + ADR

### `scripts/generate-release-notes.mjs`

Node ESM, matching the existing convention in `scripts/validate-analytics-taxonomy.mjs`
(shebang, header comment, `fileURLToPath`/`resolve` for root-relative paths). Not wired into
`turbo.json` — this is a one-shot repo-root CLI utility, not a per-workspace
build/test/lint/typecheck task. Add one root `package.json` script:
```json
"release:notes": "node scripts/generate-release-notes.mjs"
```

**Structure for testability:** keep `git log` invocation as a thin wrapper at the top of
`main()`; every parsing/formatting function (`categorize`, `parseCommitSubject`,
`extractIssueNumber`, `formatSection`, `findLastCoveredSha`) takes plain strings/arrays as
input and is exported, so tests never shell out to a real git repo (same seam-parameterization
principle already used by `resolveEnvironment(nodeEnv = process.env.NODE_ENV)` in
`apps/web/app/version/route.ts`). Guard the CLI entrypoint behind
`if (import.meta.url === \`file://${process.argv[1]}\`)`.

**"Since" boundary — self-describing marker in CHANGELOG.md, not git tags.** The repo's only
existing tag (`legacy-comparison-complete`) is an unrelated legacy artifact, and requiring a
synchronized `git tag` step on every release would reintroduce the two-artifacts-drift problem
this design exists to avoid. Instead, each generated section ends with an HTML comment:
```markdown
<!-- release-notes-digest: covers up to bce623f -->
```
The generator regex-matches the **first** such comment in the file (topmost = most recent,
since sections are prepended) and uses that SHA as the `git log <sha>..HEAD` lower bound. If
no marker is found (first-ever run, or one was accidentally stripped), it falls back to "from
the beginning of history" **and prints a loud warning** — this is a deliberate accepted
trade-off, documented in the ADR, not a silent failure mode.

**Version number — parse ROADMAP.md automatically, override with a flag.**
1. Match ROADMAP.md headings of the form `` ## vX.Y — Title `[Current]` `` (confirmed format —
   see `ROADMAP.md:13` and `:38` for the `[Shipped]` sibling tag) to find the active
   `major.minor`.
2. Scan `CHANGELOG.md` for the highest existing `## [vX.Y.N]` under that prefix; new patch is
   `N + 1` (or `1` if none exist yet).
3. If ROADMAP.md has no heading tagged `[Current]`, **fail loudly** rather than guess:
   `ERROR: no milestone in ROADMAP.md is tagged [Current]. Pass --milestone vX.Y explicitly.`
4. `--milestone vX.Y` or `--milestone vX.Y.Z` overrides either half.

**Commit parsing.** `git log --format='%H%x1f%s%x1f%b%x1e' <since>..HEAD` (unit/record
separators, safe against multi-line bodies). Per commit:
- Subject regex: `^\[(\w+)\]\s+(.+?)(?:\s+\(#(\d+)\))?$` → `type`, `description`, optional PR
  number (GitHub's auto-appended squash suffix).
- **Commits that don't match this prefix are silently skipped** — this is how legacy
  pre-convention commits (this repo's earliest 2022-era history has none) are excluded without
  special-casing dates.
- Issue link: search the body for the last `Closes #(\d+)` match (case-insensitive). If none,
  fall back to linking the PR number from the subject. If neither, no link — don't fail the
  whole run over one imperfect commit.

**Category map** (confirmed against real history — 9 types appear, not just the 7 named in
docs: `chore, feat, fix, docs, infra, test, refactor, ops, security`):
```js
const CATEGORY_MAP = { feat: 'Added', fix: 'Fixed' };
const DEFAULT_CATEGORY = 'Internal'; // any other/future type, incl. ops/security
```
Rendered section order: `### Added`, `### Fixed`, `### Internal` — omit empty sections
(Keep a Changelog convention). `Internal` bullets are prefixed with their original `` `[type]` ``
tag so contributors retain the finer signal.

**Output shape** (prepended immediately after `# Changelog` / any `## [Unreleased]` block —
never appended at the bottom; splice into the existing file rather than regenerating it whole,
so hand-edits to older sections survive):
```markdown
## [v0.3.2] - 2026-07-05

### Added
- Add configurable default workout-rounding increment ([#639](.../issues/639))

### Fixed
- Set activeProgram when completing onboarding so /cycle/N doesn't 404 ([#650](.../issues/650))

### Internal
- `[chore]` Enable Turbo caching for typecheck + test on pure packages ([#656](.../issues/656))

<!-- release-notes-digest: covers up to bce623f -->
```
Date is the run date, not the last commit's date. `--dry-run` prints without writing (also
what tests use). `--verbose` logs skipped commits to stderr.

### Seed `CHANGELOG.md` (new file, sub-issue A)

Don't dump all ~410 commits of history (defeats the "scannable" point of the format, and most
early commits pre-date the `[type]` convention anyway). Don't start fully empty either — seed
with a short retroactive baseline so the file has a correct structural skeleton the generator
can immediately splice into on the next real run:
```markdown
# Changelog

All notable changes to Lifting Logbook are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions correspond to the
milestone/patch scheme in [ROADMAP.md](ROADMAP.md), not semantic versioning.

Entries below `## [Unreleased]` are generated by
[`scripts/generate-release-notes.mjs`](scripts/generate-release-notes.mjs) — see
[ADR-032](adr/ADR-032-release-notes-and-changelog-process.md). Do not hand-edit a
generated section's `<!-- release-notes-digest: covers up to <sha> -->` marker.

## [Unreleased]

## [v0.3.1] - <merge date>

_Retroactive baseline — this repo has no prior changelog or release-tagging history;
milestone progress lives in [ROADMAP.md](ROADMAP.md) instead. Rather than reconstructing years
of untagged commits into one oversized entry, this file starts here; every release after this
one is generated._

<!-- release-notes-digest: covers up to <HEAD sha at merge time> -->
```
The implementer fills in the real date and short SHA (`git rev-parse --short HEAD`) as the
last step before opening the PR — a one-time bootstrapping detail, not a recurring cost.

### Release-cutting runbook (tag + publish — documented, not scripted)

Kept as a separate, later, manual step from the generator — you can't tag a commit that isn't
on `main` yet, and combining "compute the CHANGELOG diff" (pre-merge) with "tag and publish"
(post-merge) into one script invites running the tag step against an unmerged branch by
mistake. Document in `docs/release-process.md` (linked from the ADR, mirroring how
`docs/standards/fetch-cache-semantics.md` is a standalone doc ADR-007 references rather than
inlined):
```bash
git checkout main && git pull
git tag v0.3.2 && git push origin v0.3.2
gh release create v0.3.2 --title "v0.3.2" \
  --notes-file <(sed -n '/^## \[v0.3.2\]/,/^## \[/p' CHANGELOG.md | sed '$d')
```
This slices the just-merged section verbatim out of `CHANGELOG.md` so the GitHub Release body
is byte-identical to it. Document the PowerShell equivalent too (extract to a temp file first,
since process substitution is a bash-ism) given this repo's dual-shell support.

### `docs/adr/ADR-032-release-notes-and-changelog-process.md`

> **Numbering note:** originally scoped as ADR-030, which was taken by
> `ADR-030-github-merge-queue-adoption.md` (merged, PR #696) before this work started. The next
> candidate, ADR-031, is claimed by open (not yet merged) PR #722
> (`docs/adr/ADR-031-mandatory-review-gate.md`). ADR-032 is the next-free number as of this
> writing. **Re-check `docs/README.md`'s Architecture Decision Records table immediately before
> creating this file** — more ADRs may land between now and sub-issue A's implementation.

Follow the existing ADR-028 structural template (Status/Date/Closes/Related header → Context →
Decision → Consequences → Alternatives Considered → Verification → References). Capture: the
trigger-model decision (and why it's unlike `merge-ready-digest.yml`'s scheduled-bot pattern),
source-of-truth decision, the milestone-based versioning scheme (and explicit note that it's
independent of `package.json` versions), the category mapping, the marker-based "since"
mechanism (and why not git tags), and why the website reads the local file rather than
GitHub's API (see sub-issue B). Alternatives considered: semantic-release/changesets
(rejected — confirmed absent, would impose conflicting versioning opinions), calendar
versioning (rejected), CI-automated triggering (rejected — would require a bot commit to
`main`, conflicting with this repo's standing rule).

### Tests (sub-issue A)

No existing Jest wiring at the `scripts/` level — use Node's built-in test runner
(`node:test` + `node:assert`), zero new dependency, matching the "CLI tool" framing:
`scripts/generate-release-notes.test.mjs`, run via a new root script
`"test:scripts": "node --test scripts/*.test.mjs"`. Cover: `categorize()` for every known type
plus an unrecognized one (fallback to `Internal`); `parseCommitSubject()` for a normal
`[feat] ... (#123)` line, a no-PR-suffix line, and a non-conforming legacy subject (→ `null`,
skip); `extractIssueNumber()` against a real multi-line body fixture (e.g. shaped like the real
`bce623f` commit) both with and without `Closes #N`; `formatSection()` producing the exact
expected markdown (section order, omitted-when-empty, marker comment, `Internal` tag prefix);
`findLastCoveredSha()` with and without a marker present.

## Sub-issue B: `/whats-new` website page

### Dockerfile fix — required, confirmed gap

`apps/web/Dockerfile`'s runner stage (lines 91–120) starts from a fresh `node:20.11.1-alpine`
and copies **exactly three** paths from the builder — `.next/standalone`, `.next/static`,
`public`. `CHANGELOG.md` survives into the builder stage (via
`COPY --from=installer /app/out/full/ .`, same mechanism that carries `tsconfig.base.json`
through) but is **not** in that three-line copy list, so the page would 404/500 in production
without an explicit fix. Add a fourth line after the `public` copy:
```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/CHANGELOG.md ./CHANGELOG.md
```
Comment it with a cross-reference to ADR-032, mirroring how the `GIT_SHA` ARG above it already
cross-references ADR-028.

### Route: `apps/web/app/(authed)/whats-new/page.tsx`

Inside `(authed)`, like every other nav destination — **not** public like `/version`/`/livez`
(those are ops probes; this is a logged-in-user product feature). No `middleware.ts` change
needed. `/whats-new` chosen over `/changelog`/`/release-notes` to match this repo's
plain-English nav labels (`History`, `Programs`, `Settings`) rather than engineering
vocabulary.

**Reading the file — must handle dev vs. production `cwd` divergence.** In the standalone
production runner, `process.cwd()` is `/app` (matches the Dockerfile fix above). In `next dev`,
cwd is `apps/web/`, one level below repo root. Try both, in order, and **throw** (not silently
render blank) if neither resolves — a missing bundled file is a packaging defect, not a
legitimate runtime condition like an unreachable API:
```ts
function readChangelog(): string {
  const candidates = [
    join(process.cwd(), 'CHANGELOG.md'),             // production standalone (WORKDIR /app)
    join(process.cwd(), '..', '..', 'CHANGELOG.md'), // next dev (cwd = apps/web/)
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(`CHANGELOG.md not found at any of: ${candidates.join(', ')}`);
}
```
**No `fetch()` call exists in this route**, so `docs/standards/fetch-cache-semantics.md`'s
ESLint rule doesn't apply — note this explicitly in a code comment (content is fixed for the
container's lifetime, same reasoning as the baked-in `GIT_SHA`). The page inherits
`force-dynamic` from the root layout (already set there for unrelated reasons, per ADR-028);
no separate `dynamic` export needed — just a comment noting why that's fine here (fast local
read, not a network call).

### Parser: `apps/web/app/(authed)/whats-new/parse-changelog.ts`

Confirmed no markdown-rendering library exists anywhere in the monorepo (grepped all workspace
`package.json` files) — don't add one. Since the generator fully controls the output shape,
hand-parse the narrow known structure: `## [vX.Y.Z] - date` headings, `### Category`
subheadings, `- bullet` lines (optionally a leading `` `[type]` `` tag and a trailing
`([label](url))` link), skip HTML comment markers, and **skip `## [Unreleased]` entirely**
(nothing dated/final to show end users). Escape all free text; only ever inject fixed
`<code>`/`<a>` wrappers around escaped content via `dangerouslySetInnerHTML` — comment this
safety invariant explicitly at the call site (same spirit as ADR-028's OWASP XSS references
elsewhere in this codebase).

### Nav entry: `apps/web/app/(authed)/AppNav.tsx`

Append to the existing `LINKS` array (same `{href, label, match}` shape as the other three
entries):
```ts
{ href: '/whats-new', label: "What's New", match: '/whats-new' },
```

### Tests (sub-issue B)

- `parse-changelog.test.ts` — unit tests against a small fixture (2–3 releases, multiple
  categories, a link, an `Internal` type-tag bullet, and an `## [Unreleased]` section to
  confirm exclusion). Highest-value test here — pure logic, no DOM.
- `whats-new/page.test.tsx` — mock `node:fs`'s `readFileSync`/`existsSync`, follow whatever
  harness pattern an existing async server-component test uses (check a sibling like
  `settings/schedule/page.test.tsx` for the exact convention to copy).
- `AppNav.test.tsx` — **update the existing test**, not just add a new one: the first test
  ("renders the brand home-link and the three primary links") needs both its description and
  assertions updated for a fourth link (`getByRole('link', { name: "What's New" })`), plus
  confirm no `aria-current` on unrelated routes.
- Extend `apps/web/e2e/smoke.spec.ts` with one more numbered test (matches its existing
  convention) rather than a new spec file — this page is simple enough not to need its own:
  navigate via the nav link, assert the URL and heading, assert the seeded `v0.3.1` release
  heading is visible. Per this repo's testing rules, run
  `npm run test:e2e -w @lifting-logbook/web` locally before pushing since this touches nav
  link text/roles.

## Sub-issue C: Non-blocking staleness nag

A new scheduled GitHub Actions workflow, `.github/workflows/release-notes-staleness-check.yml`
(mirroring the cron-based precedent of `.github/workflows/merge-ready-digest.yml`), that checks
whether more than ~30 days have passed since the most recent `CHANGELOG.md` entry *and* at
least one `[feat]`/`[fix]` commit has landed on `main` since that date. If both hold, it posts
or updates a sticky advisory comment on the top-level tracking issue reminding that a release is
overdue. Purely advisory: never fails a check, never blocks a merge, never commits to `main`.
Reuses the changelog-date-parsing helper from `scripts/generate-release-notes.mjs` rather than
reimplementing that parsing a second time. Sequenced after sub-issue A merges (needs
`CHANGELOG.md` and the generator's parsing helpers to exist).

## Verification (end-to-end)

1. `node scripts/generate-release-notes.mjs --dry-run --milestone v0.3.2` against real repo
   history — confirm categorized output, correct issue links, marker comment.
2. `node --test scripts/*.test.mjs` — generator unit tests pass.
3. Run the real (non-dry-run) generator once to produce the seed `CHANGELOG.md` entry per
   sub-issue A.
4. `npm test -w @lifting-logbook/web` — `AppNav.test.tsx` and `parse-changelog.test.ts` /
   `page.test.tsx` pass.
5. `npm run test:e2e -w @lifting-logbook/web` — new smoke-spec assertion passes.
6. `npm run typecheck` (blocking CI gate per this repo's `## Testing` section).
7. Local Docker build (`docker build -f apps/web/Dockerfile .`) or at minimum a manual check
   that the runner stage's file list includes `CHANGELOG.md` — this is the step most likely to
   be silently skipped and is exactly what would 404 in production if missed.
8. Manually browse `/whats-new` in a running dev server and confirm rendering matches
   `CHANGELOG.md`'s content, then confirm the nav link works from `/history`.
9. After sub-issue A merges: follow the release-cutting runbook once for real
   (`git tag v0.3.1 && gh release create v0.3.1 ...`) and confirm the GitHub Release body
   matches the CHANGELOG.md section byte-for-byte.

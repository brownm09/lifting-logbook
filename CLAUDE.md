# Claude Code — Lifting Logbook

This file is read automatically by Claude Code at the start of every session.
It replaces the need to paste platform constraints or workflow conventions into your opening brief.
Include in your opening brief only: the issue you are working on, current branch state, and any carry-over context this file cannot know.

---

## Platform & Environment

- **OS:** Windows 11, Git Bash terminal
- **Node:** 20.11.1 (managed by nvm for Windows; `.nvmrc` is set — run `nvm use $(cat .nvmrc)` at session start if not already active).
  - **Node 24 caveat (Windows only):** `npm install` on Windows + Node 24 occasionally extracts dependency tarballs incompletely. Observed symptoms:
    - Missing directories: `node_modules/iconv-lite/lib/`
    - Truncated `.d.ts` files: `node_modules/light-my-request/types/index.d.ts` cut mid-type
    - Malformed native binaries: `node_modules/@turbo/windows-64/bin/turbo.exe` failing with `EFTYPE`

    Downstream failures: `nest build` CJS resolution errors (`iconv-lite/lib/streams`, `minimatch/dist/commonjs/index.js`), `TS1110 Type expected` from `light-my-request`, or `spawnSync ... EFTYPE` from turbo. Fix: `rm -rf node_modules/<package> && npm install <package> --no-save` to re-extract a single package, or `rm -rf node_modules && npm ci` for a full reset. CI runs Node 20 and is unaffected. Original investigation: [#373](https://github.com/brownm09/lifting-logbook/issues/373).
  - **Node 24 Jest worker OOM (Windows only):** Several `packages/core` CSV-fixture-heavy suites exhaust per-worker heap when run in parallel on Node 24. Codified workaround: `jest.config.base.js` applies `workerIdleMemoryLimit: '512MB'` + `maxWorkers: '50%'` when `process.platform === 'win32'`. Linux Node 20 CI is unaffected by both the failure and the setting. Investigation: [#419](https://github.com/brownm09/lifting-logbook/issues/419).
  - **Windows full-suite parallel-load flakes (local only):** Under a full `npm test` (`turbo run test` runs several jest processes concurrently), Windows oversubscribes the CPU and produces isolation-only flakes — the api `*.db.e2e.spec.ts` `beforeAll` hooks (DB connect + seed + Nest bootstrap) trip Jest's 5s default hook timeout, and a slow web suite occasionally reports `1 failed`. Codified workaround: the two `apps/api/src/**/*.db.e2e.spec.ts` suites pass an explicit 30s `beforeAll` timeout (`DB_E2E_HOOK_TIMEOUT_MS`; apps/api's jest config is standalone and does not extend the win32-capped base), and `jest.config.base.js` adds `testTimeout: 15000` on win32 for the base-extending workspaces (web/core/types/api-client). Linux CI keeps the 5s default. Investigation: [#567](https://github.com/brownm09/lifting-logbook/issues/567).
- **Package manager:** npm (workspaces)
- **`jq` is NOT available.** Use `node -e` with a temp file in the working directory for JSON parsing:
  ```bash
  TMPFILE="tmp_$$.json"
  some-command --format json > "$TMPFILE"
  node -e "
    const d = JSON.parse(require('fs').readFileSync('$TMPFILE','utf8'));
    console.log('VAR=' + d.field);
  "
  rm -f "$TMPFILE"
  ```
- **Never use `/tmp/`** for temp files — Node.js on Windows cannot resolve Git Bash Unix paths. Write temp files to the working directory instead.
- **`gh` CLI** is available and authenticated. The `project` scope must be added separately when needed: `gh auth refresh -s project`.
- **Prefer Git Bash** over PowerShell for scripting — PowerShell handles arrays and arithmetic differently and has caused failures in this environment.

### Tooling constraints

- **Turborepo 2.x requires a `packageManager` field in the root `package.json`.** Without it, `turbo run *` fails with `Could not resolve workspaces. Missing packageManager field in package.json`. Always ensure `packageManager` is set when scaffolding a new monorepo root or upgrading Turborepo.
- **ESLint 9 uses flat config (`eslint.config.js`), not `.eslintrc.js`.** ESLint 9 dropped `.eslintrc*` support by default, so creating an `.eslintrc.js` silently does nothing. When an issue or acceptance criterion references `.eslintrc.js`, create `eslint.config.js` instead and note the translation in the PR description. Use `@typescript-eslint/eslint-plugin`'s `flat/recommended` config — it is an array of three objects (entry 0 registers the plugin and sets the parser via `languageOptions`), so spread the whole array rather than configuring the parser separately. To fall back to the legacy config format, set `ESLINT_USE_FLAT_CONFIG=false`. Validated in PR #24.

---

## Repository Layout

Turborepo monorepo with npm workspaces:

```
packages/core        — pure domain logic (no infrastructure dependencies)
packages/types       — shared TypeScript interfaces and API contracts
packages/api-client  — typed REST client with pluggable auth (shared by web server + browser)
apps/api             — NestJS + Fastify (primary): REST + GraphQL
apps/web             — Next.js App Router frontend
apps/mobile          — React Native (Expo) mobile client
infra/kubernetes/    — GKE Autopilot manifests and Helm charts
infra/cloud-run/     — Cloud Run service YAML
infra/terraform/     — Shared infrastructure: VPC, load balancer, DNS, IAM
docs/adr/            — Architecture Decision Records (ADR-001 through ADR-012)
docs/README.md       — Full architecture narrative and ADR index
scripts/             — Repository automation scripts
```

Architecture follows hexagonal / Ports & Adapters. `packages/core` has zero infrastructure dependencies. See [`docs/README.md`](docs/README.md) for full context.

---

## GitHub Project & Epic Assignment

All new issues must be added to the **Lifting Logbook** project and assigned an epic before work begins.

**Important:** All `gh project item-list` queries in this file use `--limit 300` to avoid truncation. The project has 267+ items (default limit is 30). If the project grows beyond 300 items, increase this limit accordingly.

**Project IDs (needed for CLI commands):**
- Project number: `2`, owner: `brownm09`
- Project node ID: `PVT_kwHOAjEKvM4BTuEF`
- Epic field ID: `PVTSSF_lAHOAjEKvM4BTuEFzhA7GEs`

**Epic options:**

| Name | Option ID |
|---|---|
| Monorepo Scaffolding | `9dcd9556` |
| Package & App Scaffolding | `ae06cfdd` |
| Port Interfaces | `cc1ae008` |
| Shared Types | `a6b59698` |
| CI/CD Foundation | `fc0df03b` |
| Architecture & Documentation | `f7202bcd` |
| Observability | `d3c68018` |
| API Implementation | `50a1da76` |
| Client Applications | `31d3931e` |
| Operations | `0c3f26d2` |

> **IDs regenerate on every option mutation.** `updateProjectV2Field` with `singleSelectOptions` is a full replacement — passing the existing options unchanged still produces new IDs and drops every item's prior assignment. Always follow the **Backup-and-restore procedure** below before any mutation, and update this table immediately after.

**Backup-and-restore procedure (mandatory before adding/removing/renaming any single-select option):**

1. Snapshot current Epic assignments to a git-tracked file:
   ```bash
   mkdir -p .claude/backups
   STAMP=$(date +%Y-%m-%d-%H%M%S)
   gh api graphql -f query='
     query { node(id: "PVT_kwHOAjEKvM4BTuEF") { ... on ProjectV2 {
       items(first: 100) { nodes { id content { ... on Issue { number title } }
         fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue {
           name field { ... on ProjectV2SingleSelectField { name } } } } } } } } } }' \
     > .claude/backups/project-epic-snapshot-$STAMP.json
   git add .claude/backups/project-epic-snapshot-$STAMP.json
   git commit -m "[chore] Snapshot project Epic assignments before option mutation"
   ```
2. Run the `updateProjectV2Field` mutation with the full desired option list (existing names + new/changed).
3. Capture the new option IDs from the mutation response and update the **Epic options** table above in the same PR as the snapshot.
4. Restore assignments by reading the snapshot and re-issuing `gh project item-edit` for each item, mapping the snapshot's epic name → new option ID.

If a mutation runs without a prior snapshot commit, stop and recover from the latest snapshot in `.claude/backups/` before continuing any other work.

**Milestones:**

| Title | Number |
|---|---|
| v0.1 — Foundation | `1` |
| v0.2 — Core API | `2` |
| v0.3 — Client Applications | `3` |

**Workflow — run after `gh issue create`:**

```bash
# Requires project scope — add once if needed: gh auth refresh -s project

# 1. Set milestone (use the milestone title)
gh issue edit <N> --milestone "<milestone-title>"

# 2. Add issue to project, capture item ID
TMPFILE="tmp_$$.json"
gh project item-add 2 --owner brownm09 --url <issue-url> --format json > "$TMPFILE"
ITEM_ID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$TMPFILE','utf8')); console.log(d.id);")
rm -f "$TMPFILE"

# 3. Set Epic field
gh project item-edit --project-id PVT_kwHOAjEKvM4BTuEF --id "$ITEM_ID" \
  --field-id PVTSSF_lAHOAjEKvM4BTuEFzhA7GEs \
  --single-select-option-id <option-id>
```

If `--format json` is not supported by the installed `gh` version, fall back to the GraphQL API via `gh api graphql`.

---

## Standard Issue Workflow

> **Prerequisite:** ensure the issue is already in the Lifting Logbook project with an Epic set (see above).

1. Read the issue body and acceptance criteria: `gh issue view <N>`
2. Create a branch: `git checkout -b <type>/issue-<N>-<slug>` (see Branch Naming)
3. Move the issue to **In Progress** on the project board:
   ```bash
   TMPFILE="C:/Users/brown/.claude/scratch/tmp_item_<N>.json"
   gh project item-list 2 --owner brownm09 --limit 300 --format json > "$TMPFILE"
   ITEM_ID=$(node -e "
     const d=JSON.parse(require('fs').readFileSync('$TMPFILE','utf8'));
     const item=d.items.find(i=>i.content&&i.content.number===<N>);
     console.log(item.id);
   ")
   rm -f "$TMPFILE"
   gh project item-edit --project-id PVT_kwHOAjEKvM4BTuEF --id "$ITEM_ID" \
     --field-id PVTSSF_lAHOAjEKvM4BTuEFzhA7F7E \
     --single-select-option-id 47fc9ee4
   ```
4. Implement the changes
5. Commit with `Closes #<N>` in the message (see Commit Format)
6. Push: `git push -u origin <branch>`
7. Open a PR: `gh pr create --title "<prefix> <title>" --body "..."`
8. After PR approval: squash merge with `gh pr merge <N> --squash --delete-branch`
9. Move the issue to **Done** on the project board:
   ```bash
   TMPFILE="C:/Users/brown/.claude/scratch/tmp_item_<N>.json"
   gh project item-list 2 --owner brownm09 --limit 300 --format json > "$TMPFILE"
   ITEM_ID=$(node -e "
     const d=JSON.parse(require('fs').readFileSync('$TMPFILE','utf8'));
     const item=d.items.find(i=>i.content&&i.content.number===<N>);
     console.log(item.id);
   ")
   rm -f "$TMPFILE"
   gh project item-edit --project-id PVT_kwHOAjEKvM4BTuEF --id "$ITEM_ID" \
     --field-id PVTSSF_lAHOAjEKvM4BTuEFzhA7F7E \
     --single-select-option-id 98236657
   ```
10. Pull main: `git checkout main && git pull`
11. Close the issue if not auto-closed: `gh issue close <N>`
12. Update journals and tracking:
    - **Project journal** (`sessions/lifting-logbook/`): append to the day's draft (PR merged, decisions made)
    - **Meta journal** (`sessions/meta/`): update if `CLAUDE.md` was modified or a new platform constraint was discovered
    - **ROADMAP.md**: if this PR completes a work stream listed in a milestone's Active Work table, move that row to the milestone's Shipped table; if the Active Work table becomes empty, replace it with `| *(all shipped)* | | |`
13. Write a `<!-- next-session-context -->` block to the draft and display it as the closing output of the session

---

## Branch Naming

| Issue type | Pattern | Example |
|---|---|---|
| chore / scaffold | `chore/issue-<N>-<slug>` | `chore/issue-2-root-tooling` |
| feature | `feat/issue-<N>-<slug>` | `feat/issue-5-core-migration` |
| infrastructure | `infra/issue-<N>-<slug>` | `infra/issue-16-ci-pipeline` |
| documentation | `docs/issue-<N>-<slug>` | `docs/issue-15-shared-types` |
| bug fix | `fix/issue-<N>-<slug>` | `fix/issue-22-auth-token-expiry` |

---

## Commit Message Format

```
[<type>] <imperative-mood description>

<body — optional, for non-obvious decisions or multi-part changes>

Closes #<N>
```

**Types:** `chore`, `feat`, `fix`, `docs`, `infra`, `test`, `refactor`

**Example:**
```
[chore] Initialize Turborepo monorepo with workspace structure

Converts root package.json to private workspaces, adds turbo.json pipeline,
and creates directory skeleton with .gitkeep placeholders.

Closes #1
```

---

## PR Conventions

- **Title format:** `[<type>] <description>` (matching the commit type prefix)
- **Body:** Summary paragraph + Acceptance Criteria checklist (copy from issue) + test instructions
- **Merge strategy:** Squash merge only — keeps `main` history linear
- **Branch cleanup:** Always pass `--delete-branch` on merge

---

## Files to Never Read

These files are large and never need to be read directly:

- `package-lock.json` — 8,000+ lines; commit it without reading it
- `node_modules/**` — never relevant
- `.turbo/**` — build cache, never relevant

---

## Worktree Setup

Claude Code creates git worktrees under `.claude/worktrees/` when running tasks in isolation.
A new worktree has its own directory but **does not inherit a working `node_modules`** from the
main repo. Before the first commit in a worktree, always run:

```bash
npm install
```

**Why this is required:**

- The pre-commit hook (`npx turbo run lint`) needs `turbo`, which is a native binary downloaded
  during the `postinstall` script. Without `npm install`, the hook fails with
  `Error: spawnSync ... EUNKNOWN` or `%1 is not a valid Win32 application`.
- On Windows, worktrees under paths containing `.claude` cannot spawn the native `turbo.exe`
  from that path. `.husky/pre-commit` works around this by setting `TURBO_BINARY_PATH` to
  the main repo root's turbo binary — but this only works if `npm install` has been run in the
  worktree first, so that `npx turbo` resolves correctly. See [ADR-022](docs/adr/ADR-022-monorepo-docker-build-strategy.md) for broader context on why the toolchain is sensitive to install state.

**Symptom if skipped:** `Lint failed. Commit aborted.` or a Node.js `EUNKNOWN` crash on the first
`git commit`.

**Recovery after a failed `npm ci` (EUSAGE) + `npm install`:** when a lockfile-drift `npm ci`
fails mid-install and you recover with `npm install`, the worktree-local `node_modules/turbo` can
be left **missing or incomplete** — the test suite may have kept running via the *global* `turbo`,
masking the gap. The next `git commit` then fails the `.husky/pre-commit` lint hook with
`Lint failed. Commit aborted.` **even though `npx turbo run lint` passes standalone** (the hook
requires the worktree-local `turbo` via `TURBO_BINARY_PATH`, not the global one). The fix is a
clean **`npm ci`** once the lockfile is back in sync — *not* another `npm install`, which can
leave the same partial-extract state. Motivating incident: the #570/#571 session (Windows, Node 20).

---

## CLI Scripting Checklist

Before writing a `gh` or other CLI automation script:

1. Run `<command> --help` first to confirm flag names and syntax
2. Confirm which JSON tools are available (`jq` is NOT available — use `node -e`)
3. Confirm temp file location (`C:/Users/brown/.claude/scratch/`, not `/tmp/` or a project repo directory)
4. Check whether any additional `gh` auth scopes are needed

---

## Proposals and Roadmap

### /propose workflow

Run `/propose <one-line idea>` from the repo root to introduce a new feature or change.
The skill handles the full flow: clarifying questions → proposal doc → GitHub issue → ROADMAP entry → PR.

Do not create `docs/proposals/` files or ROADMAP entries manually unless `/propose` is
unavailable. The skill ensures the issue, epic, and milestone are assigned consistently.

### docs/proposals/ convention

- Files live at `docs/proposals/YYYY-MM-DD-<slug>.md`
- The master template is at `dev-env/claude/templates/proposal.md` — do not duplicate it here
- Statuses: `draft` → `accepted` → `shipped` | `declined`
- Update the `**Status:**` field in the proposal file when status changes
- Update the linked issue's milestone or labels to match if scope changes

### ROADMAP.md maintenance

- `ROADMAP.md` at the repo root is the editorial view; it is **not** a GitHub mirror
- `/propose` appends rows to the correct milestone's **Proposals** table automatically
- Update the **Active Work** tables manually when: an item starts, completes, or moves milestones
- Material milestone-scope changes (dropping or moving items) require a PR with an explicit
  explanation — same bar as material changes to `docs/PRD.md`

---

## Coding Standards

App-level coding standards are in `docs/standards/`. Each file is a self-contained rule with
rationale, examples, and enforcement notes. Existing standards:

| File | Applies to | Rule |
|---|---|---|
| [`docs/standards/fetch-cache-semantics.md`](docs/standards/fetch-cache-semantics.md) | `apps/web` Server Components | All `fetch()` calls must specify `{ cache: 'no-store' }` or `{ next: { revalidate: N } }` explicitly |
| [`docs/standards/error-fallback-test-coverage.md`](docs/standards/error-fallback-test-coverage.md) | all packages and apps | Error-swallowing fallbacks (`.catch(() => default)`, `?? default`, try/catch returning neutral) require a data-level assertion, a paired success-path test, or a documented structure-only comment |

When implementing `apps/web`, read the relevant standards before writing any `fetch()` calls.

---

## Testing

Run `npm test` from the repo root to execute the full test suite across all workspaces.

```bash
npm test
```

**Prerequisites:**
- Run `npm run build` first if you have touched compiled output (e.g., API controllers, shared types in `packages/types`).
- The API DB E2E suite (`apps/api/src/programs/programs.db.e2e.spec.ts`) auto-provisions Postgres via Testcontainers in `apps/api/jest.global-setup.js`. Docker Desktop must be running; no `DATABASE_URL` configuration is required locally. In CI, the existing service container provides `DATABASE_URL` and globalSetup uses it directly.
- **When Docker is down:** globalSetup hard-fails with a multi-line actionable message naming three recovery options (fix Docker, use `docker-compose.test.yml`, or set `LIFTING_SKIP_DB_E2E=1`). The escape hatch is only valid when the diff under test touches no DB code (no changes under `apps/api/prisma/`, no repository changes); cite [issue #394](https://github.com/brownm09/lifting-logbook/issues/394) in the PR body when it is used. See [`docs/testing/e2e-coverage.md`](docs/testing/e2e-coverage.md) for the full recovery procedure.

Individual workspaces can be verified independently:

```bash
npm test -w @lifting-logbook/core
npm test -w @lifting-logbook/api
npm test -w @lifting-logbook/web
```

### apps/web Playwright E2E (local)

`apps/web` has two test layers. `npm test -w @lifting-logbook/web` runs Jest unit/component tests only. A separate Playwright suite lives in `apps/web/e2e/` and runs in CI's "Playwright E2E" job — it does **not** run as part of `npm test`.

**Run it locally before pushing whenever a change touches `apps/web` and any of the following:**

- UI display strings (headings, button labels, link text)
- `aria-label` values on inputs or regions
- Role names, tab labels, dialog titles
- Any string a Playwright `getByLabel` / `getByRole` / `locator('text=...')` call might match

```bash
# From the repo root — playwright.config.ts auto-starts mock-api (port 3004) and next dev (port 3000)
npm run test:e2e -w @lifting-logbook/web
```

Playwright browsers must be installed once (`npx playwright install chromium`; CI uses the `--with-deps` form for its Linux runner — that flag is a no-op on Windows). The config handles all env vars (dummy Clerk keys, `DEV_AUTH_TOKEN`, `API_URL`) so no manual setup is needed. The motivating incident is [#444](https://github.com/brownm09/lifting-logbook/issues/444) / PR #438, where an aria-label rename (`Back Squat` → `Squat`) passed Jest but broke the smoke spec and was only caught by CI.

### Coverage Requirements

<!-- When #259 ships: remove the "until then" clause from the frontend row below. Tracked as a checklist item on issue #259. -->

| Change type | Required coverage |
|---|---|
| New API endpoint | In-memory E2E test in the same PR |
| New frontend page or interactive feature | Playwright test once #259 is implemented; until then, a written test plan in the PR body |
| `apps/web` UI string / aria-label / role-name change | Run `npm run test:e2e -w @lifting-logbook/web` locally before pushing (see above) |
| Bug fix | Regression test that fails before the fix and passes after |
| Refactor / docs only | None required — existing tests must pass |

**Blocking rule:** A PR that adds an API endpoint or frontend feature without satisfying the above is not mergeable.

### Failure-tracking rule

Every test failure reported in a pre-PR run must be resolved in one of two ways before `gh pr create`:

1. **Fixed in this PR** (default).
2. **Tracked by an open GitHub issue cited in the PR body** by number — prose explanation alone is not sufficient. If the failure does not yet have an issue, file one before opening the PR.

A label of "pre-existing" without an open-issue link is not acceptable. The motivating incident is [#349 / PR #355](https://github.com/brownm09/lifting-logbook/pull/355), where four API suite-load failures were carried as "pre-existing" until a one-line `postinstall` hook fixed the entire class — the rule should have forced the investigation up front. The global equivalent of this rule is tracked in [dev-env#281](https://github.com/brownm09/dev-env/issues/281).

### Skewed-test rule

When a PR adds or modifies a `.catch(() => default)`, `?? default`, or `try { … } catch { return neutral }` in a server component or API boundary, the test coverage for that code path must satisfy one of: (a) a data-level assertion the fallback would not produce, (b) a separate test that fails specifically when the upstream fails, or (c) an inline comment that names the swallowed-fallback source line and explains why structure-only is intentional. See [`docs/standards/error-fallback-test-coverage.md`](docs/standards/error-fallback-test-coverage.md) for the full rule and examples.

### CI not firing — merge conflict silences GitHub Actions

**Pattern:** A PR in `CONFLICTING` (merge conflict) state causes GitHub Actions `pull_request` events to never fire. GitHub cannot create the virtual merge commit at `refs/pull/N/merge`, so the event is silently dropped — no checks are queued, no runs appear.

**Symptom:** `gh pr checks` returns "no checks reported" and `gh run list --branch <branch-name>` shows only stale runs from before the conflict.

**Diagnosis:**
```bash
gh pr view <N> --json mergeable,mergeStateStatus
# mergeable: "CONFLICTING" — direct conflict indicator; mergeStateStatus will also be "DIRTY"
```

**Fix:** Rebase (or squash-rebase) the branch onto `origin/main` and force-push. Once the conflict is resolved, GitHub recreates the merge ref and CI fires normally on the next push.

Motivating incident: [PR #604](https://github.com/brownm09/lifting-logbook/pull/604).

---

## Observability

This repo runs a full OpenTelemetry + Grafana Cloud stack. The Plan-then-optimize → Pass 3
**Observability** dimension defers to this section (per dev-env [ADR-042](https://github.com/brownm09/dev-env/blob/main/docs/adr/042-plan-risk-dimension-audit-and-observability-section.md)).

### Convention

- **Logging** — `nestjs-pino` (Pino), **structured JSON**, standard Pino levels (runtime-configurable). Configured in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts). Auth-bearing headers are redacted with `remove: true` (`req.headers.authorization`, `req.headers.cookie`, `req/res set-cookie`); `/health` is excluded from auto-logging to control Grafana Cloud log spend.
- **Tracing & metrics** — OpenTelemetry NodeSDK in [`apps/api/src/otel.ts`](apps/api/src/otel.ts): `OTLPTraceExporter` + `OTLPMetricExporter` (OTLP/HTTP) with `getNodeAutoInstrumentations()` (HTTP/Fastify, `pg`, Node built-ins). Service name defaults to `lifting-logbook-api`. The web app instruments via `@vercel/otel` ([`apps/web/instrumentation.ts`](apps/web/instrumentation.ts)).
- **Backends** — Grafana Cloud via the OTel Collector: traces → **Tempo**, logs → **Loki**, metrics → **Mimir** (see [ADR-018](docs/adr/ADR-018-observability-stack.md)).
- **Log↔trace correlation** — a Pino `mixin()` injects `trace_id` / `span_id` from the active span into every log line, enabling bidirectional Loki↔Tempo navigation in Grafana.
- **Errors** — domain exceptions are mapped to HTTP responses by per-feature exception filters (e.g. `apps/api/src/programs/conflict.filter.ts`, `not-found.filter.ts`); request/response logging — including error responses, carrying `trace_id`/`span_id` via the `mixin` — is emitted by `nestjs-pino`/`pino-http` auto-logging. Error spans on the failing request are retained by the tail-based sampling policy ([ADR-020](docs/adr/ADR-020-tail-based-sampling-policy.md)).

### What the Observability audit dimension must verify for this repo

1. **Raw SQL is NOT auto-traced.** `@prisma/instrumentation` is excluded from the OTel SDK due to an SDK v1/v2 incompatibility ([ADR-024](docs/adr/ADR-024-prisma-otel-sdk-override.md)). Prisma Client ORM calls and any `$queryRaw` / `$executeRaw` emit **no spans**. Any new raw-SQL call site must be wrapped in a **manual span** to remain observable. (There are currently zero raw-SQL usages — this is a forward-looking gate.)
2. **LLM adapters apply NO PII scrubbing to prompts.** The cycle-planning adapters (`apps/api/src/adapters/llm/anthropic-cycle-planning.adapter.ts`, `openai-compatible-cycle-planning.adapter.ts`) send user context to the provider unscrubbed. New LLM call sites must consider prompt-content exposure before sending or logging.
3. **Redaction covers headers, not arbitrary payloads.** The Pino `redact` config strips auth headers/cookies only. New API boundaries must log at appropriate levels and must never log secrets, tokens, or sensitive request/response bodies.

### References

[ADR-018](docs/adr/ADR-018-observability-stack.md) (stack), [ADR-019](docs/adr/ADR-019-slo-methodology.md) (SLOs), [ADR-020](docs/adr/ADR-020-tail-based-sampling-policy.md) (tail sampling), [ADR-021](docs/adr/ADR-021-no-test-tracing.md) (no test tracing), [ADR-024](docs/adr/ADR-024-prisma-otel-sdk-override.md) (Prisma SDK override); operational runbook: [`docs/runbooks/observability.md`](docs/runbooks/observability.md).

---

## Documentation and Citations

When writing or updating any architectural documentation (ADRs, design docs, READMEs):

- **Every ADR must have a `## References` section.** New ADRs get one on creation. Existing ADRs get one when they receive substantive edits. See `docs/adr-references.md` for the established pattern.
- **Update `docs/adr-references.md`** whenever an ADR's references change — it is the consolidated index.
- **Cite primary sources, not summaries.** Three categories:
  - *Official documentation* — for technology and framework choices (NestJS, Next.js, Prisma, etc.)
  - *Specifications* — for protocol and standard choices (IETF RFCs, OASIS specs, GraphQL spec, OpenID Connect)
  - *Foundational writings* — for architectural patterns (Cockburn's Hexagonal Architecture, Uncle Bob's Clean Architecture, Fowler articles)
- **Regulatory references** (GDPR, HIPAA, SOC 2) must link to the primary regulatory source, not a summary or blog post.
- **When recommending a technology in any response**, include a link to its official documentation in that same response — not just the name.

---

## Engineering Journal

After each session (or at natural breakpoints for long sessions), create or update a session
transcript in `brownm09/engineering-journal`.

**File location:** `sessions/lifting-logbook/YYYY-MM-DD-<slug>.md`

**Scratch directory:** `C:/Users/brown/.claude/scratch/` — all processing tmp files (`gh` output,
JSON parsing intermediaries, etc.) go here regardless of which project is active. Never write
tmp files into a project repo working directory.

---

### Draft file workflow

One draft file per calendar day, living on a dedicated branch in the engineering-journal repo.
Slug is determined at day end when the overall theme is clear.

**Branch:** `draft/YYYY-MM-DD` — created at the first session of the day, merged to main at day end.

**First session of the day:**
1. `git -C <engineering-journal-path> checkout main && git pull`
2. `git -C <engineering-journal-path> checkout -b draft/YYYY-MM-DD`
3. Create `sessions/lifting-logbook/YYYY-MM-DD_draft.md` with the opening brief and first
   `<!-- session: <slug> -->` block
4. `git add`, `git commit -m "draft: YYYY-MM-DD session 1"`, `git push -u origin draft/YYYY-MM-DD`

**Subsequent sessions:**
1. `git -C <engineering-journal-path> checkout draft/YYYY-MM-DD && git -C <engineering-journal-path> pull`
2. Get the file's line count (`wc -l`), then `Read` with offset to retrieve only the last
   `<!-- next-session-context -->` block — do not read the full draft
3. Append the new `<!-- session: <slug> -->` block and `<!-- next-session-context -->` paragraph
   using `Edit`
4. Add a `<!-- tokens: input=N output=N cost≈$N -->` comment at the end of the session block,
   drawn from the Claude Code CLI session summary
5. `git add`, `git commit -m "draft: YYYY-MM-DD session N"`, `git push`

**End of day (last session):**
1. Read the full draft once to compose the final 11-section document
2. Write as `sessions/lifting-logbook/YYYY-MM-DD-<slug>.md`
3. Delete the draft file
4. `git add`, `git commit -m "[docs] Add YYYY-MM-DD journal: <slug>"`
5. Open a PR from `draft/YYYY-MM-DD` into `main`, squash merge, delete branch

---

### Draft structure during the day

```
<!-- draft: YYYY-MM-DD -->
Opening brief: ...

<!-- session: <first-slug> -->
## <Topic>
...
<!-- tokens: input=12,450 output=3,200 cost≈$0.08 -->
<!-- next-session-context -->
<one paragraph — copy to open next session>

<!-- session: <second-slug> -->
## <Topic>
...
<!-- tokens: input=18,900 output=4,100 cost≈$0.12 -->
<!-- next-session-context -->
<one paragraph — copy to open next session>
```

---

### Canonical 11-section structure (composed once at day end)

1. Header block (Topic, Repo/Branch, Issues closed, PRs merged)
2. Table of Contents
3. Opening Brief (paste the Next Session Context from the previous day verbatim)
4. Key Decisions (bullet list with links to sections, issues, PRs, ADRs)
5. Dialogue sections (one H2 per task or topic, drawn from draft)
6. Open Items / Next Steps (checkbox list)
7. Token Usage (per-session breakdown tables: model, est. input tokens, est. output tokens,
   est. cost — drawn from `<!-- tokens: ... -->` comments in the draft; when comments are
   absent use retroactive estimates based on session scope, labeled as "retroactive estimate";
   close with a Combined totals table)
8. Token Optimization Suggestions (2–4 per-session observations grouped under a `### Session N`
   heading; close with a `### Cross-Session Patterns` subsection for generalizable findings
   that apply across multiple sessions)
9. Next Session Context (the final `<!-- next-session-context -->` block from the draft)
10. Reflection (gaps, risks, strategic questions — written last)
11. Further Reading (1–3 primary sources per session that explain the reasoning behind key
    decisions; intended for deliberate study between sessions — link + one sentence on why
    it matters)

---

### Update triggers

**Project journal** (`sessions/lifting-logbook/`):
- Append to draft when a PR is merged or a strategic decision is made
- Compose and publish the daily document at end of last session of the day

**Meta journal** (`sessions/meta/`):
- When `CLAUDE.md` is modified — record what changed, why, and which session prompted it
- When a new platform constraint is discovered — record the symptom, root cause, and fix pattern
- When a workflow failure mode is discovered and remediated — record the symptom, root cause,
  and fix pattern
- When a cross-project convention is established — record the convention and which projects it
  affects
- When the journal structure itself changes — record the new section, placement, and rationale
- When a new canonical reference repo or external resource is identified — record the resource
  and its role

**Full journal conventions:** See [`brownm09/engineering-journal`](https://github.com/brownm09/engineering-journal) → `sessions/meta/2026-04-05-workflow-and-journal-setup.md`

# Claude Code — Lifting Logbook

This file is read automatically by Claude Code at the start of every session.
It replaces the need to paste platform constraints or workflow conventions into your opening brief.
Include in your opening brief only: the issue you are working on, current branch state, and any carry-over context this file cannot know.

---

## Platform & Environment

- **OS:** Windows 11, Git Bash terminal
- **Node:** 20.11.1 (managed by nvm for Windows; `.nvmrc` is set — run `nvm use` at session start if not already active)
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

---

## Repository Layout

Turborepo monorepo with npm workspaces:

```
packages/core        — pure domain logic (no infrastructure dependencies)
packages/types       — shared TypeScript interfaces and API contracts
apps/api             — NestJS + Fastify (primary): REST + GraphQL
apps/api-legacy      — Express (legacy comparison): REST only
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

**Project IDs (needed for CLI commands):**
- Project number: `2`, owner: `brownm09`
- Project node ID: `PVT_kwHOAjEKvM4BTuEF`
- Epic field ID: `PVTSSF_lAHOAjEKvM4BTuEFzhA7GEs`

**Epic options:**

| Name | Option ID |
|---|---|
| Monorepo Scaffolding | `974b67c1` |
| Package & App Scaffolding | `26d27ab2` |
| Port Interfaces | `9196ffd9` |
| Shared Types | `42bf8843` |
| CI/CD Foundation | `23133b3a` |
| Architecture & Documentation | `656e470c` |

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
3. Implement the changes
4. Commit with `Closes #<N>` in the message (see Commit Format)
5. Push: `git push -u origin <branch>`
6. Open a PR: `gh pr create --title "<prefix> <title>" --body "..."`
7. After PR approval: squash merge with `gh pr merge <N> --squash --delete-branch`
8. Pull main: `git checkout main && git pull`
9. Close the issue if not auto-closed: `gh issue close <N>`

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

## CLI Scripting Checklist

Before writing a `gh` or other CLI automation script:

1. Run `<command> --help` first to confirm flag names and syntax
2. Confirm which JSON tools are available (`jq` is NOT available — use `node -e`)
3. Confirm temp file location (working directory, not `/tmp/`)
4. Check whether any additional `gh` auth scopes are needed

---

## Coding Standards

App-level coding standards are in `docs/standards/`. Each file is a self-contained rule with
rationale, examples, and enforcement notes. Existing standards:

| File | Applies to | Rule |
|---|---|---|
| [`docs/standards/fetch-cache-semantics.md`](docs/standards/fetch-cache-semantics.md) | `apps/web` Server Components | All `fetch()` calls must specify `{ cache: 'no-store' }` or `{ next: { revalidate: N } }` explicitly |

When implementing `apps/web`, read the relevant standards before writing any `fetch()` calls.

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

After each session (or at natural breakpoints for long sessions), create or update a session transcript in `brownm09/engineering-journal`.

**File location:** `sessions/lifting-logbook/YYYY-MM-DD-<slug>.md`

**Draft file workflow:**

One draft file per calendar day: `sessions/lifting-logbook/YYYY-MM-DD_draft.md`. Slug is determined at day end when the overall theme is clear.

1. **First session of the day:** Create the draft with the opening brief and a `<!-- session: <slug> -->` marker. Append dialogue sections as work progresses.
2. **Subsequent sessions:** GET the draft, append a new `<!-- session: <slug> -->` marker and dialogue sections, PUT. Read only the draft — never a completed prior journal.
3. **End of each session:** Write a `<!-- next-session-context -->` block to the draft (one paragraph). Copy it — this is the opening brief for the next session.
4. **End of day (last session):** Compose the full 10-section document in one pass from the draft. Publish as `YYYY-MM-DD-<slug>.md`. Delete the draft.

Why: Framework sections (TOC, Key Decisions, Token Usage, Reflection) are written once at day end when the full picture is available. Mid-day appends cost only proportional to that day's accumulated content, not historical journals. Next Session Context is decoupled — produced per session, consumed by the next.

Draft structure during the day:
```
<!-- draft: YYYY-MM-DD -->
Opening brief: ...

<!-- session: <first-slug> -->
## <Topic>
...
<!-- next-session-context -->
<one paragraph — copy to open next session>

<!-- session: <second-slug> -->
## <Topic>
...
<!-- next-session-context -->
<one paragraph — copy to open next session>
```

**Canonical 11-section structure** (composed once at day end):
1. Header block (Topic, Repo/Branch, Issues closed, PRs merged)
2. Table of Contents
3. Opening Brief (paste the Next Session Context from the previous day verbatim)
4. Key Decisions (bullet list with links to sections, issues, PRs, ADRs)
5. Dialogue sections (one H2 per task or topic, drawn from draft)
6. Open Items / Next Steps (checkbox list)
7. Token Usage (table per session with estimated cost)
8. Token Optimization Suggestions (what drove cost; 3–5 suggestions)
9. Next Session Context (the final `<!-- next-session-context -->` block from the draft)
10. Reflection (gaps, risks, strategic questions — written last)
11. Further Reading (1–3 primary sources per session that explain the reasoning behind key decisions; intended for deliberate study between sessions — link + one sentence on why it matters)

**Project journal update triggers** (`sessions/lifting-logbook/`):
- Append to draft when a PR is merged or a strategic decision is made
- Compose and publish the daily document at end of last session of the day

**Meta journal update triggers** (`sessions/meta/`):
- When `CLAUDE.md` is modified — record what changed, why, and which session prompted it
- When a new platform constraint is discovered — record the symptom, root cause, and fix pattern

**Full journal conventions:** See [`brownm09/engineering-journal`](https://github.com/brownm09/engineering-journal) → `sessions/meta/2026-04-05-workflow-and-journal-setup.md`

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

## Standard Issue Workflow

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

## Engineering Journal

After each session (or at natural breakpoints for long sessions), create or update a session transcript in `brownm09/engineering-journal`.

**File location:** `sessions/lifting-logbook/YYYY-MM-DD-<slug>.md`

**Canonical 10-section structure:**
1. Header block (Topic, Repo/Branch, Issues closed, PRs merged)
2. Table of Contents
3. Opening Brief (paste the Next Session Context from the previous entry verbatim)
4. Key Decisions (bullet list with links to sections, issues, PRs, ADRs)
5. Dialogue sections (one H2 per task or topic)
6. Open Items / Next Steps (checkbox list)
7. Token Usage (table per session with estimated cost)
8. Token Optimization Suggestions (what drove cost; 3–5 suggestions)
9. Next Session Context (paste-ready paragraph for the next session opening brief)
10. Reflection (gaps, risks, strategic questions — written last)

**Journal update triggers:**
- When a PR is merged (close out that issue's section)
- When a strategic decision is made that doesn't belong in an ADR
- At session end

**Full journal conventions:** See [`brownm09/engineering-journal`](https://github.com/brownm09/engineering-journal) → `sessions/meta/2026-04-05-workflow-and-journal-setup.md`

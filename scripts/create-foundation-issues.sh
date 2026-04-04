#!/usr/bin/env bash
# =============================================================================
# create-foundation-issues.sh
#
# Creates labels, the v0.1 — Foundation milestone, and all 17 issues for the
# cloud-native repository's first milestone.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Run from the root of the TARGET repository (not the GAS repo)
#
# Usage:
#   bash scripts/create-foundation-issues.sh
# =============================================================================

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "==> Creating Foundation issues for: $REPO"
echo ""

# ── Labels ────────────────────────────────────────────────────────────────────

echo "==> Creating labels..."
gh label create "epic"  --color "0075ca" --description "Top-level feature area"        --force
gh label create "feat"  --color "a2eeef" --description "New functionality"             --force
gh label create "chore" --color "e4e669" --description "Setup, tooling, config"        --force
gh label create "infra" --color "d93f0b" --description "Infrastructure / IaC"         --force
gh label create "docs"  --color "0052cc" --description "Documentation"                 --force
gh label create "spike" --color "cc317c" --description "Research / proof of concept"   --force
echo ""

# ── Milestone ─────────────────────────────────────────────────────────────────

echo "==> Creating milestone..."
MILESTONE_NUMBER=$(gh api "repos/$REPO/milestones" \
  --method POST \
  -f title="v0.1 — Foundation" \
  -f description="Monorepo scaffolding, core package migration, port interfaces, and CI pipeline. All subsequent milestones depend on this." \
  -f state="open" \
  --jq ".number")
echo "    Milestone #$MILESTONE_NUMBER created."
echo ""

# Helper — creates one issue and prints its URL
create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  local url
  url=$(gh issue create \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "v0.1 — Foundation")
  echo "    $url  $title"
}

# =============================================================================
# EPIC: Monorepo Scaffolding
# =============================================================================
echo "==> Epic: Monorepo Scaffolding"

create_issue \
"[chore] Initialize Turborepo monorepo with workspace structure" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md) — Monorepo Structure with Turborepo.

## Acceptance Criteria
- [ ] Root \`package.json\` defines workspaces: \`packages/*\`, \`apps/*\`
- [ ] \`turbo\` installed as a root dev dependency
- [ ] \`turbo.json\` created with placeholder pipeline tasks (\`build\`, \`test\`, \`lint\`, \`dev\`)
- [ ] Directory structure matches ADR-001:
  \`\`\`
  packages/core/
  packages/types/
  apps/api/
  apps/api-legacy/
  apps/web/
  apps/mobile/
  infra/kubernetes/
  infra/cloud-run/
  infra/terraform/
  docs/adr/
  docs/README.md
  \`\`\`
- [ ] Root \`README.md\` links to \`docs/README.md\`

## Notes
Use \`npx create-turbo\` as a starting point. Prefer npm workspaces for compatibility." \
"chore"

create_issue \
"[chore] Configure root TypeScript, ESLint, and Jest" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md). Shared tooling config at the root reduces duplication across packages and apps.

## Acceptance Criteria
- [ ] \`tsconfig.base.json\` at root with strict settings; all packages extend it
- [ ] \`.eslintrc.js\` at root configured for TypeScript; packages inherit it
- [ ] \`jest.config.base.js\` at root with shared transform settings
- [ ] \`packages/core\` and \`packages/types\` each have a \`tsconfig.json\` extending root
- [ ] \`turbo run lint\` and \`turbo run test\` execute without error

## Notes
Port the existing \`.eslintrc.json\` and \`jest.config.js\` from the GAS repo as starting points." \
"chore"

create_issue \
"[chore] Configure Turborepo pipeline (build, test, lint, dev)" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md). The pipeline defines task dependencies and cache behaviour across all packages and apps.

## Acceptance Criteria
- [ ] \`turbo.json\` defines tasks: \`build\`, \`test\`, \`lint\`, \`dev\`
- [ ] \`build\`: outputs to \`dist/**\`, depends on upstream \`^build\`
- [ ] \`test\`: depends on \`build\`, not cached (set \`cache: false\`)
- [ ] \`lint\`: no outputs, runs independently
- [ ] \`dev\`: \`persistent: true\`, no cache
- [ ] \`turbo run build\` completes without error across all packages
- [ ] Cache inputs exclude \`.env\` files and test fixtures

## Notes
\`packages/core\` must be built before \`apps/api\` — the \`^build\` upstream dependency handles this automatically." \
"chore"

create_issue \
"[chore] Configure multi-stage Docker builds with turbo prune" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md) and [ADR-009](docs/adr/ADR-009-infrastructure-kubernetes-cloud-run.md). Each deployable app needs a minimal Docker image that includes only its relevant workspace packages.

## Acceptance Criteria
- [ ] \`apps/api/Dockerfile\` — three stages: \`installer\` (turbo prune), \`builder\` (npm ci + build), \`runner\` (production image)
- [ ] \`apps/web/Dockerfile\` — same three-stage pattern
- [ ] \`.dockerignore\` at root excludes \`node_modules\`, \`.turbo\`, \`.git\`, \`**/*.test.ts\`
- [ ] \`docker build -f apps/api/Dockerfile .\` succeeds from repo root
- [ ] \`docker build -f apps/web/Dockerfile .\` succeeds from repo root
- [ ] Production images run as a non-root user

## Notes
Use \`turbo prune --scope=@logbook/api --docker\` to generate a minimal workspace snapshot. See Turborepo docs for the canonical multi-stage Dockerfile pattern." \
"chore,infra"

# =============================================================================
# EPIC: Package & App Scaffolding
# =============================================================================
echo ""
echo "==> Epic: Package & App Scaffolding"

create_issue \
"[chore] Scaffold packages/core — migrate GAS core logic" \
"## Context
See [ADR-002](docs/adr/ADR-002-ports-and-adapters.md). The existing \`src/core/\` from the GAS repo has no GAS dependencies and migrates directly. This is the highest-value asset being carried forward.

## Acceptance Criteria
- [ ] \`packages/core/package.json\`: \`name: \"@logbook/core\"\`, \`main: \"dist/index.js\"\`, \`types: \"dist/index.d.ts\"\`
- [ ] \`packages/core/tsconfig.json\` extends root \`tsconfig.base.json\`
- [ ] All files from \`src/core/\` copied to \`packages/core/src/\`
- [ ] All tests from \`tests/core/\` copied to \`packages/core/tests/\` and passing
- [ ] Test fixtures from \`tests/fixtures/\` copied with paths updated
- [ ] \`packages/core/src/index.ts\` exports all public services, models, and utilities
- [ ] \`turbo run test --filter=@logbook/core\` passes

## Notes
Do not change any logic during migration — lift-and-shift only. Open a separate issue for any refactoring discovered during the move." \
"chore"

create_issue \
"[chore] Scaffold packages/types — shared TypeScript package" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md). \`packages/types\` holds shared TypeScript types consumed by \`apps/api\`, \`apps/web\`, and \`apps/mobile\`. Populated in follow-on issues.

## Acceptance Criteria
- [ ] \`packages/types/package.json\`: \`name: \"@logbook/types\"\`
- [ ] \`packages/types/tsconfig.json\` extends root config
- [ ] \`packages/types/src/index.ts\` exists and compiles (may be empty)
- [ ] \`apps/api\`, \`apps/web\`, and \`apps/mobile\` each list \`@logbook/types\` as a workspace dependency
- [ ] \`turbo run build --filter=@logbook/types\` succeeds" \
"chore"

create_issue \
"[chore] Scaffold apps/api — NestJS with Fastify adapter" \
"## Context
See [ADR-011](docs/adr/ADR-011-api-server-nestjs-and-express.md). The primary API server. NestJS bootstrapped with Fastify as the underlying HTTP adapter for better throughput.

## Acceptance Criteria
- [ ] \`apps/api/package.json\`: \`name: \"@logbook/api\"\`
- [ ] NestJS installed with \`@nestjs/platform-fastify\`
- [ ] \`main.ts\` bootstraps using \`FastifyAdapter\`
- [ ] \`GET /health\` returns \`{ status: 'ok', timestamp: <ISO string> }\`
- [ ] App depends on \`@logbook/core\` and \`@logbook/types\`
- [ ] Starts with \`turbo run dev --filter=@logbook/api\`
- [ ] \`turbo run test --filter=@logbook/api\` passes (health check test included)

## Notes
Use the NestJS CLI (\`nest new\`) then swap Express for Fastify per the NestJS docs. No domain modules yet — those come in the API milestone." \
"chore"

create_issue \
"[chore] Scaffold apps/api-legacy — Express with TypeScript" \
"## Context
See [ADR-011](docs/adr/ADR-011-api-server-nestjs-and-express.md). The legacy comparison server. Intentionally minimal: manual routing, no DI container, no decorators.

## Acceptance Criteria
- [ ] \`apps/api-legacy/package.json\`: \`name: \"@logbook/api-legacy\"\`
- [ ] Express and TypeScript installed
- [ ] \`src/server.ts\` creates and exports the Express app
- [ ] \`GET /health\` returns \`{ status: 'ok', timestamp: <ISO string> }\`
- [ ] App depends on \`@logbook/core\` and \`@logbook/types\`
- [ ] Starts with \`turbo run dev --filter=@logbook/api-legacy\`
- [ ] \`turbo run test --filter=@logbook/api-legacy\` passes

## Notes
Keep this deliberately simple. No decorators, no DI framework. The contrast with \`apps/api\` is intentional and is the point of having both." \
"chore"

create_issue \
"[chore] Scaffold apps/web — Next.js App Router" \
"## Context
See [ADR-007](docs/adr/ADR-007-nextjs-app-router-web-frontend.md). Next.js with the App Router. No Clerk integration yet — that comes in the Auth milestone (v0.3).

## Acceptance Criteria
- [ ] \`apps/web/package.json\`: \`name: \"@logbook/web\"\`
- [ ] Created with \`create-next-app\` (TypeScript, App Router, no \`src/\` directory)
- [ ] Root layout (\`app/layout.tsx\`) and placeholder landing page (\`app/page.tsx\`) exist
- [ ] Depends on \`@logbook/types\`
- [ ] Starts with \`turbo run dev --filter=@logbook/web\`
- [ ] \`next build\` completes without error

## Notes
Do not implement any feature pages yet. The landing page is a placeholder." \
"chore"

create_issue \
"[chore] Scaffold apps/mobile — Expo managed workflow" \
"## Context
See [ADR-008](docs/adr/ADR-008-mobile-strategy.md). React Native with Expo Managed Workflow (Phase 1). No screens yet — just the shell that subsequent milestones build on.

## Acceptance Criteria
- [ ] \`apps/mobile/package.json\`: \`name: \"@logbook/mobile\"\`
- [ ] Created with \`npx create-expo-app\` using the TypeScript template
- [ ] Default \`App.tsx\` replaced with a placeholder screen showing the app name
- [ ] Depends on \`@logbook/types\`
- [ ] Starts with \`turbo run dev --filter=@logbook/mobile\` (runs \`expo start\`)
- [ ] \`expo export\` completes without error

## Notes
Expo Managed Workflow is intentional for Phase 1. The Kotlin replacement is a separate milestone." \
"chore"

# =============================================================================
# EPIC: Port Interfaces
# =============================================================================
echo ""
echo "==> Epic: Port Interfaces"

create_issue \
"[feat] Define data repository port interfaces" \
"## Context
See [ADR-002](docs/adr/ADR-002-ports-and-adapters.md). These five interfaces are the primary contract between the domain layer and all data store adapters. No implementation code in this issue — interfaces only.

## Interfaces to Define

All in \`apps/api/src/ports/\`:
- \`IWorkoutRepository\`
- \`ITrainingMaxRepository\`
- \`ICycleDashboardRepository\`
- \`ILiftingProgramSpecRepository\`
- \`ILiftRecordRepository\`

Method signatures should use domain model types from \`@logbook/core\`.

## Acceptance Criteria
- [ ] All five interfaces defined in \`apps/api/src/ports/\`
- [ ] Each interface has a corresponding compile-time test (assign a mock object to the interface type and verify it satisfies the contract)
- [ ] All interfaces exported from \`apps/api/src/ports/index.ts\`
- [ ] TypeScript compiles without error across the monorepo

## Notes
Derive method signatures from the existing repository classes in the GAS repo's \`src/api/repositories/\`. Keep method names identical — they become the permanent adapter contract." \
"feat"

create_issue \
"[feat] Define IAuthProvider interface and AuthUser type" \
"## Context
See [ADR-005](docs/adr/ADR-005-authentication-strategy.md) and [ADR-002](docs/adr/ADR-002-ports-and-adapters.md). The auth provider interface is the contract that all auth adapters (Clerk, Auth0, future providers) must satisfy. The application never depends on a specific provider — only on this interface.

## Acceptance Criteria
- [ ] \`AuthUser\` type defined: \`{ id: string; email: string; provider: string; displayName?: string }\`
- [ ] \`IAuthProvider\` interface defined: \`{ verifyToken(token: string): Promise<AuthUser> }\`
- [ ] Both defined in \`apps/api/src/ports/auth.ts\`
- [ ] Both exported from \`apps/api/src/ports/index.ts\`
- [ ] Compile-time test: a mock object satisfying the interface is assigned and type-checked
- [ ] TypeScript compiles without error" \
"feat"

create_issue \
"[feat] Define IRepositoryFactory interface and RepositoryBundle type" \
"## Context
See [ADR-003](docs/adr/ADR-003-per-user-data-store-config.md) and [ADR-002](docs/adr/ADR-002-ports-and-adapters.md). The factory resolves the correct data store adapter for each authenticated user at request time. This is the central DI seam for the per-user adapter strategy.

## Acceptance Criteria
- [ ] \`RepositoryBundle\` type defined, containing all five data repository interfaces
- [ ] \`IRepositoryFactory\` interface defined: \`{ forUser(user: AuthUser): Promise<RepositoryBundle> }\`
- [ ] Both defined in \`apps/api/src/ports/factory.ts\`
- [ ] Both exported from \`apps/api/src/ports/index.ts\`
- [ ] Compile-time test verifying the type relationships
- [ ] TypeScript compiles without error

## Notes
\`forUser\` returns a \`Promise\` because the factory performs a DB lookup to resolve the user's adapter config. The async boundary lives here, not in the caller." \
"feat"

# =============================================================================
# EPIC: Shared Types
# =============================================================================
echo ""
echo "==> Epic: Shared Types"

create_issue \
"[feat] Define shared domain types in packages/types" \
"## Context
Primitive domain concepts shared across the API, web frontend, and mobile app. Defining them once in \`@logbook/types\` prevents duplication and drift.

## Acceptance Criteria
- [ ] \`packages/types/src/domain.ts\` defines:
  - \`LiftName\` — union of supported lifts (derive from \`src/core/constants/\` in GAS repo)
  - \`WeightUnit\` — \`'lbs' | 'kg'\`
  - \`WeekNumber\` — \`1 | 2 | 3 | 4\`
  - \`CycleNumber\` — \`number\` (with JSDoc noting it is 1-indexed)
- [ ] All types exported from \`packages/types/src/index.ts\`
- [ ] \`@logbook/core\` imports \`LiftName\` and \`WeightUnit\` from \`@logbook/types\` where applicable, eliminating any internal duplicates
- [ ] TypeScript compiles without error across the monorepo

## Notes
Check \`src/core/constants/config.ts\` and \`src/core/constants/schema.ts\` in the GAS repo for the canonical lift list and config values." \
"feat"

create_issue \
"[feat] Define shared API contract types in packages/types" \
"## Context
Request and response shapes for the REST API and GraphQL schema inputs. Defining them in \`@logbook/types\` means web and mobile clients import the exact types the API produces.

## Acceptance Criteria
- [ ] \`packages/types/src/api.ts\` defines:
  - \`TrainingMaxResponse\`, \`UpdateTrainingMaxesRequest\`
  - \`WorkoutResponse\`
  - \`LiftRecordResponse\`, \`CreateLiftRecordRequest\`
  - \`CycleDashboardResponse\`
- [ ] All types exported from \`packages/types/src/index.ts\`
- [ ] TypeScript compiles without error

## Notes
These are the serialized (JSON-compatible) forms of domain models — plain objects only, no class methods. They will be used to type API responses in \`apps/api\` and to type \`fetch\` calls in \`apps/web\` and \`apps/mobile\`." \
"feat"

# =============================================================================
# EPIC: CI/CD Foundation
# =============================================================================
echo ""
echo "==> Epic: CI/CD Foundation"

create_issue \
"[chore] Configure GitHub Actions: lint and test on PR" \
"## Context
See [ADR-001](docs/adr/ADR-001-monorepo-structure.md). Every PR must pass lint and tests across all affected packages before merge. Turborepo's caching ensures only changed packages are re-tested.

## Acceptance Criteria
- [ ] \`.github/workflows/ci.yml\` created
- [ ] Triggers on: \`pull_request\` targeting \`main\`
- [ ] Steps: checkout → setup Node (version from \`engines\` in root \`package.json\`) → \`npm ci\` → \`turbo run lint test\`
- [ ] \`~/.npm\` and \`.turbo\` directories cached between runs
- [ ] Workflow passes on a clean branch with no changes
- [ ] \`ci\` status check required in \`main\` branch protection rules

## Notes
Use Turborepo Remote Cache (Vercel's free tier or a self-hosted GCS backend) to share cache across CI runs. Without it, every CI run is a cold start." \
"chore,infra"

create_issue \
"[chore] Configure GitHub Actions: Docker build and push on merge to main" \
"## Context
See [ADR-009](docs/adr/ADR-009-infrastructure-kubernetes-cloud-run.md). On merge to \`main\`, Docker images for \`apps/api\` and \`apps/web\` are built and pushed to Google Artifact Registry. Deployment to GKE / Cloud Run comes in the Infrastructure milestone.

## Acceptance Criteria
- [ ] \`.github/workflows/deploy.yml\` created
- [ ] Triggers on: \`push\` to \`main\`
- [ ] Authenticates to GCP using Workload Identity Federation (no JSON key files in secrets)
- [ ] Builds \`apps/api\` image tagged \`<registry>/api:<sha>\` and \`<registry>/api:latest\`
- [ ] Builds \`apps/web\` image tagged \`<registry>/web:<sha>\` and \`<registry>/web:latest\`
- [ ] Both images pushed to Artifact Registry on success
- [ ] Workflow does NOT deploy to GKE or Cloud Run (that is the Infrastructure milestone)

## Notes
Use \`google-github-actions/auth\` with Workload Identity Federation. This is the GCP-recommended approach and avoids long-lived credentials in GitHub secrets." \
"chore,infra"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==> Done."
ISSUE_COUNT=$(gh issue list --milestone "v0.1 — Foundation" --json number --jq "length")
echo "    $ISSUE_COUNT issues created under milestone 'v0.1 — Foundation'."
echo "    View: $(gh repo view --json url -q .url)/issues?milestone=v0.1+%E2%80%94+Foundation"

#!/usr/bin/env bash
# =============================================================================
# create-github-project.sh
#
# Creates and fully configures the GitHub Project (v2) for lifting-logbook:
#   - Creates the project under the repo owner
#   - Links it to the repository
#   - Adds custom fields: Epic (single-select), Priority (single-select)
#   - Adds all v0.1 — Foundation issues
#   - Sets Epic and Priority values per issue via GraphQL
#
# Prerequisites:
#   - gh CLI authenticated with the 'project' scope
#     (gh auth refresh -s project  — then complete the browser step)
#   - Node.js on PATH (used for JSON parsing; jq not required)
#   - Run from the root of the repository
#
# Usage:
#   bash scripts/create-github-project.sh
# =============================================================================

set -euo pipefail

OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PROJECT_TITLE="Lifting Logbook"

echo "==> Creating GitHub Project (v2) for: $REPO"
echo ""

# ── 1. Create Project ─────────────────────────────────────────────────────────

echo "==> Creating project '$PROJECT_TITLE'..."
PROJECT_NUMBER=$(gh project create \
  --owner "$OWNER" \
  --title "$PROJECT_TITLE" \
  --format json --jq '.number')
PROJECT_URL="https://github.com/users/${OWNER}/projects/${PROJECT_NUMBER}"
echo "    Project #$PROJECT_NUMBER created: $PROJECT_URL"
echo ""

# ── 2. Link Project to Repository ─────────────────────────────────────────────

echo "==> Linking project to repository $REPO..."
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$REPO"
echo "    Linked."
echo ""

# ── 3. Add Custom Fields ──────────────────────────────────────────────────────

echo "==> Adding custom fields..."

# Note: flag is --single-select-options (plural), may be repeated
gh project field-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --name "Epic" \
  --data-type SINGLE_SELECT \
  --single-select-options "Monorepo Scaffolding" \
  --single-select-options "Package & App Scaffolding" \
  --single-select-options "Port Interfaces" \
  --single-select-options "Shared Types" \
  --single-select-options "CI/CD Foundation"
echo "    Epic field created."

gh project field-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --name "Priority" \
  --data-type SINGLE_SELECT \
  --single-select-options "P0 — Critical" \
  --single-select-options "P1 — High" \
  --single-select-options "P2 — Normal"
echo "    Priority field created."
echo ""

# ── 4. Add Issues to Project ──────────────────────────────────────────────────

echo "==> Adding v0.1 — Foundation issues to project..."
while IFS= read -r url; do
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" > /dev/null
  echo "    Added: $url"
done < <(gh issue list \
  --repo "$REPO" \
  --milestone "v0.1 — Foundation" \
  --limit 50 \
  --json url \
  --jq 'sort_by(.url) | .[].url')
echo ""

# ── 5. Fetch Project Graph IDs via GraphQL ────────────────────────────────────

echo "==> Fetching project metadata (IDs)..."
TMPFILE="gh_project_data_$$.json"
gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
        items(first: 50) {
          nodes {
            id
            content {
              ... on Issue { number title }
            }
          }
        }
      }
    }
  }
' -f owner="$OWNER" -F number="$PROJECT_NUMBER" > "$TMPFILE"

# Parse using Node.js (jq not required on Windows)
eval "$(node -e "
const d = JSON.parse(require('fs').readFileSync('$TMPFILE','utf8')).data.user.projectV2;
const epic = d.fields.nodes.find(f => f.name === 'Epic');
const prio = d.fields.nodes.find(f => f.name === 'Priority');
console.log('PROJECT_ID=' + d.id);
console.log('EPIC_FIELD_ID=' + epic.id);
console.log('PRIORITY_FIELD_ID=' + prio.id);
epic.options.forEach(o => console.log('EPIC_OPT_' + o.name.replace(/[^A-Za-z0-9]/g,'_').toUpperCase() + '=' + o.id));
prio.options.forEach(o => console.log('PRIO_OPT_' + o.name.replace(/[^A-Za-z0-9]/g,'_').toUpperCase() + '=' + o.id));
d.items.nodes.filter(i=>i.content&&i.content.number).forEach(i => console.log('ITEM_' + i.content.number + '=' + i.id));
")"
rm -f "$TMPFILE"

OPT_MONOREPO="$EPIC_OPT_MONOREPO_SCAFFOLDING"
OPT_PACKAGE="$EPIC_OPT_PACKAGE___APP_SCAFFOLDING"
OPT_PORTS="$EPIC_OPT_PORT_INTERFACES"
OPT_TYPES="$EPIC_OPT_SHARED_TYPES"
OPT_CICD="$EPIC_OPT_CI_CD_FOUNDATION"
OPT_P1="$PRIO_OPT_P1___HIGH"

item_id_for_issue() {
  local varname="ITEM_$1"
  echo "${!varname}"
}

# ── GraphQL mutation helper ────────────────────────────────────────────────────

set_field() {   # $1=item_id  $2=field_id  $3=option_id
  gh api graphql -f query='
    mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project
        itemId:    $item
        fieldId:   $field
        value:     { singleSelectOptionId: $option }
      }) { projectV2Item { id } }
    }
  ' -f project="$PROJECT_ID" \
    -f item="$1" \
    -f field="$2" \
    -f option="$3" > /dev/null
}

# ── 6. Set Epic Field Values ───────────────────────────────────────────────────

echo "==> Setting Epic field values..."
for n in 1 2 3 4;      do set_field "$(item_id_for_issue $n)" "$EPIC_FIELD_ID" "$OPT_MONOREPO" && echo "    #$n → Monorepo Scaffolding"; done
for n in 5 6 7 8 9 10; do set_field "$(item_id_for_issue $n)" "$EPIC_FIELD_ID" "$OPT_PACKAGE"  && echo "    #$n → Package & App Scaffolding"; done
for n in 11 12 13;     do set_field "$(item_id_for_issue $n)" "$EPIC_FIELD_ID" "$OPT_PORTS"    && echo "    #$n → Port Interfaces"; done
for n in 14 15;        do set_field "$(item_id_for_issue $n)" "$EPIC_FIELD_ID" "$OPT_TYPES"    && echo "    #$n → Shared Types"; done
for n in 16 17;        do set_field "$(item_id_for_issue $n)" "$EPIC_FIELD_ID" "$OPT_CICD"     && echo "    #$n → CI/CD Foundation"; done
echo ""

# ── 7. Set Priority = P1 — High for All Issues ────────────────────────────────

echo "==> Setting Priority = P1 — High for all issues..."
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17; do
  set_field "$(item_id_for_issue $n)" "$PRIORITY_FIELD_ID" "$OPT_P1" && echo "    #$n → P1 — High"
done
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────

ITEM_COUNT=$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq '.items | length')
echo "==> Done."
echo ""
echo "    Project:  $PROJECT_URL"
echo "    Items:    $ITEM_COUNT"
echo ""
echo "    Suggested next steps:"
echo "      1. Open the project and add a 'Board' view grouped by Epic"
echo "      2. Add an 'Iteration' field for sprints when active development starts"
echo "      3. Set branch protection on main to require the 'ci' status check (issue #16)"

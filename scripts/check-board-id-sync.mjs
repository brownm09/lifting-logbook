#!/usr/bin/env node
/**
 * Validates that the three GitHub Project board-ID caches agree with one another:
 *
 *   - .claude/hook-config.json — field IDs + the `epic_options` map read by the
 *     post-tool-use.py project-board hook (which prints them verbatim, with no live fetch)
 *   - .claude/propose.json     — the `github_project` block + `epics` array read by /propose
 *   - CLAUDE.md                — the "Project IDs" block, the Epic-options table, and the
 *     Standard-Issue-Workflow / Backup-and-restore `gh` snippets
 *
 * One `updateProjectV2Field` mutation — or an org transfer — re-cuts the project node ID, the
 * single-select field IDs, and every Epic option ID at once. Refreshing only some of the caches
 * is the dangerous failure mode: the board hook then writes to a dead field. That is exactly what
 * the 2026-05-10 mutation did, leaving hook-config.json stale until #627. See #865 (finding B3
 * of #864, the org transfer that re-cut every one of these IDs).
 *
 * SCOPE: this is a *drift* guard, not a *liveness* guard. It proves the three caches agree with
 * each other — NOT that they match the live GitHub API. Three caches stale in lockstep pass by
 * design; verifying against the live board stays the manual step in CLAUDE.md's
 * Backup-and-restore procedure (a live API call would need network + auth in CI).
 *
 * Usage: node scripts/check-board-id-sync.mjs
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export const HOOK_CONFIG_FILE = '.claude/hook-config.json';
export const PROPOSE_FILE = '.claude/propose.json';
export const CLAUDE_MD_FILE = 'CLAUDE.md';

// --- Pure parsing helpers (exported for unit testing — see check-board-id-sync.test.mjs) ---

function unique(values) {
  return [...new Set(values)];
}

/** Every whole-match of a /g/ pattern. */
function allTokens(source, pattern) {
  return [...source.matchAll(pattern)].map((m) => m[0]);
}

/** Capture group 1 of every match of a /g/ pattern. */
function allCaptures(source, pattern) {
  return [...source.matchAll(pattern)].map((m) => m[1]);
}

/** Capture group 1 of the first match, or undefined. */
function firstCapture(source, pattern) {
  const match = source.match(pattern);
  return match ? match[1] : undefined;
}

export function parseHookConfig(json) {
  const epics = json.epic_options;
  return {
    owner: json.project_owner,
    // hook-config stores the project number as a string ("2"); propose.json as an int (2).
    number: json.project_number === undefined ? undefined : String(json.project_number),
    nodeId: json.project_node_id,
    epicFieldId: json.epic_field_id,
    statusFieldId: json.status_field_id,
    doneOptionId: json.done_option_id,
    epics: epics && typeof epics === 'object' ? { ...epics } : undefined,
  };
}

export function parseProposeConfig(json) {
  const epics = Array.isArray(json.epics)
    ? Object.fromEntries(json.epics.map((epic) => [epic.name, epic.id]))
    : undefined;
  const project = json.github_project;
  if (!project || typeof project !== 'object') {
    return { epics };
  }
  return {
    owner: project.owner,
    number: project.number === undefined ? undefined : String(project.number),
    nodeId: project.node_id,
    epicFieldId: project.epic_field_id,
    epics,
  };
}

/**
 * Reads the `| Name | `optionId` |` rows of CLAUDE.md's Epic-options table. Scoped to the table
 * that follows the `**Epic options:**` marker, so the Milestones table (whose values are plain
 * integers, not 8-hex option IDs) can never be picked up by accident.
 */
export function parseEpicOptionsTable(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '**Epic options:**');
  if (start === -1) return undefined;

  const epics = {};
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      if (inTable) break;
      continue;
    }
    if (!line.startsWith('|')) break;
    inTable = true;
    // Header (`| Name | Option ID |`) and separator (`|---|---|`) rows do not match.
    const row = line.match(/^\|\s*(.+?)\s*\|\s*`([0-9a-f]{8})`\s*\|$/);
    if (row) epics[row[1]] = row[2];
  }
  return inTable ? epics : undefined;
}

/**
 * Extracts every board identifier CLAUDE.md carries. The node ID, owner and project number each
 * appear several times (the "Project IDs" block, the GraphQL snippets, and the `gh project`
 * flags), so these are returned as *distinct-value sets* — a partial hand-edit of one occurrence
 * is a real failure mode and shows up here as a set of size > 1.
 *
 * Owner is deliberately read only from unambiguous board-command contexts. A blanket scan for the
 * org name would false-positive forever on the legitimate github.com/<owner>/dev-env links that
 * CLAUDE.md cites.
 */
export function parseClaudeMd(source) {
  return {
    nodeIds: unique(allTokens(source, /PVT_kw[A-Za-z0-9_-]+/g)),
    fieldIds: unique(allTokens(source, /PVTSSF_[A-Za-z0-9_-]+/g)),
    declaredNodeId: firstCapture(source, /Project node ID:\s*`(PVT_kw[A-Za-z0-9_-]+)`/),
    declaredEpicFieldId: firstCapture(source, /Epic field ID:\s*`(PVTSSF_[A-Za-z0-9_-]+)`/),
    owners: unique([
      ...allCaptures(source, /owner:\s*`([A-Za-z0-9][A-Za-z0-9-]*)`/g),
      ...allCaptures(source, /--owner\s+([A-Za-z0-9][A-Za-z0-9-]*)/g),
      ...allCaptures(source, /repository\(owner:\s*"([A-Za-z0-9][A-Za-z0-9-]*)"/g),
    ]),
    numbers: unique([
      ...allCaptures(source, /Project number:\s*`(\d+)`/g),
      ...allCaptures(source, /gh project item-add\s+(\d+)\b/g),
      ...allCaptures(source, /select\(\.project\.number==(\d+)\)/g),
    ]),
    // The literal `<option-id>` placeholder in the epic-assignment snippet is skipped by the
    // 8-hex guard; the real values are the Status transitions in workflow steps 3 and 9.
    optionIdsInSnippets: unique(
      allCaptures(source, /--single-select-option-id\s+([0-9a-f]{8})\b/g),
    ),
    epics: parseEpicOptionsTable(source),
  };
}

/**
 * Returns a list of human-readable drift descriptions. An empty list means the caches agree.
 * All problems are collected rather than returning on the first — a partial refresh typically
 * breaks several values at once, and seeing them together is what tells you which cache is stale.
 */
export function compareBoardIds({ hook, propose, claudeMd }) {
  const problems = [];

  const requireValue = (value, label) => {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${label} is missing or is not a string.`);
      return false;
    }
    return true;
  };

  const requireEpics = (epics, label) => {
    if (!epics || typeof epics !== 'object' || Object.keys(epics).length === 0) {
      problems.push(`${label} is missing or has no entries.`);
      return false;
    }
    return true;
  };

  requireValue(hook.nodeId, `${HOOK_CONFIG_FILE} → project_node_id`);
  requireValue(hook.epicFieldId, `${HOOK_CONFIG_FILE} → epic_field_id`);
  requireValue(hook.statusFieldId, `${HOOK_CONFIG_FILE} → status_field_id`);
  requireValue(hook.doneOptionId, `${HOOK_CONFIG_FILE} → done_option_id`);
  requireValue(hook.owner, `${HOOK_CONFIG_FILE} → project_owner`);
  requireValue(hook.number, `${HOOK_CONFIG_FILE} → project_number`);
  requireEpics(hook.epics, `${HOOK_CONFIG_FILE} → epic_options`);

  requireValue(propose.nodeId, `${PROPOSE_FILE} → github_project.node_id`);
  requireValue(propose.epicFieldId, `${PROPOSE_FILE} → github_project.epic_field_id`);
  requireValue(propose.owner, `${PROPOSE_FILE} → github_project.owner`);
  requireValue(propose.number, `${PROPOSE_FILE} → github_project.number`);
  requireEpics(propose.epics, `${PROPOSE_FILE} → epics`);

  requireValue(claudeMd.declaredNodeId, `${CLAUDE_MD_FILE} → "Project node ID:" declaration`);
  requireValue(claudeMd.declaredEpicFieldId, `${CLAUDE_MD_FILE} → "Epic field ID:" declaration`);
  requireEpics(claudeMd.epics, `${CLAUDE_MD_FILE} → Epic-options table`);

  // 1. CLAUDE.md must agree with itself before it is worth comparing against anything else.
  const internal = [
    ['project node ID', claudeMd.nodeIds, 'the "Project IDs" block, the GraphQL snippets, and every --project-id flag'],
    ['project owner', claudeMd.owners, 'the "Project IDs" block, --owner flags, and the GraphQL repository(owner:) lookups'],
    ['project number', claudeMd.numbers, 'the "Project IDs" block, `gh project item-add`, and the .project.number filters'],
  ];
  for (const [label, values, where] of internal) {
    if (values.length > 1) {
      problems.push(
        `${CLAUDE_MD_FILE} disagrees with itself on the ${label} — found ${values.length} distinct ` +
          `values (${values.join(', ')}). It is repeated in ${where}; all occurrences must match.`,
      );
    }
  }

  // 2. Classify CLAUDE.md's field IDs against hook-config, which is the only cache that labels
  //    which field is which. This is also what cross-checks the Status field ID, since
  //    propose.json does not carry one.
  if (
    typeof hook.epicFieldId === 'string' &&
    typeof hook.statusFieldId === 'string' &&
    claudeMd.fieldIds.length > 0
  ) {
    const known = new Set([hook.epicFieldId, hook.statusFieldId]);
    const unknown = claudeMd.fieldIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      problems.push(
        `${CLAUDE_MD_FILE} references field ID(s) absent from ${HOOK_CONFIG_FILE}: ${unknown.join(', ')}. ` +
          `Expected only Epic (${hook.epicFieldId}) and Status (${hook.statusFieldId}). Refresh the caches ` +
          'together — or, if a new single-select field was added to the board, cache it in ' +
          `${HOOK_CONFIG_FILE} and extend this guard.`,
      );
    }
    for (const [label, id] of [['Epic', hook.epicFieldId], ['Status', hook.statusFieldId]]) {
      if (!claudeMd.fieldIds.includes(id)) {
        problems.push(
          `${CLAUDE_MD_FILE} never references the ${label} field ID (${id}) cached in ${HOOK_CONFIG_FILE}. ` +
            "A stale ID in CLAUDE.md's snippets sends board edits to a dead field.",
        );
      }
    }
  }

  // 3. Cross-file scalars.
  const onlyValue = (values) => (values.length === 1 ? values[0] : undefined);
  const compareAcross = (label, entries) => {
    const present = entries.filter((entry) => typeof entry.value === 'string' && entry.value !== '');
    if (present.length < 2) return;
    if (unique(present.map((entry) => entry.value)).length > 1) {
      problems.push(
        `${label} disagrees across caches:\n` +
          present.map((entry) => `      ${entry.file} → ${entry.value}`).join('\n'),
      );
    }
  };

  compareAcross('Project node ID', [
    { file: HOOK_CONFIG_FILE, value: hook.nodeId },
    { file: PROPOSE_FILE, value: propose.nodeId },
    { file: CLAUDE_MD_FILE, value: claudeMd.declaredNodeId },
  ]);
  compareAcross('Epic field ID', [
    { file: HOOK_CONFIG_FILE, value: hook.epicFieldId },
    { file: PROPOSE_FILE, value: propose.epicFieldId },
    { file: CLAUDE_MD_FILE, value: claudeMd.declaredEpicFieldId },
  ]);
  compareAcross('Project owner', [
    { file: HOOK_CONFIG_FILE, value: hook.owner },
    { file: PROPOSE_FILE, value: propose.owner },
    { file: CLAUDE_MD_FILE, value: onlyValue(claudeMd.owners) },
  ]);
  compareAcross('Project number', [
    { file: HOOK_CONFIG_FILE, value: hook.number },
    { file: PROPOSE_FILE, value: propose.number },
    { file: CLAUDE_MD_FILE, value: onlyValue(claudeMd.numbers) },
  ]);

  // The "In Progress" option ID has no cached counterpart, so only Done is cross-checked.
  if (typeof hook.doneOptionId === 'string' && claudeMd.optionIdsInSnippets.length > 0) {
    if (!claudeMd.optionIdsInSnippets.includes(hook.doneOptionId)) {
      problems.push(
        `Done option ID ${hook.doneOptionId} (${HOOK_CONFIG_FILE} → done_option_id) does not appear in ` +
          `${CLAUDE_MD_FILE}'s --single-select-option-id snippets (found: ` +
          `${claudeMd.optionIdsInSnippets.join(', ')}).`,
      );
    }
  }

  // 4. Epic option maps: same names everywhere, then the same ID per name.
  const epicSources = [
    { file: HOOK_CONFIG_FILE, epics: hook.epics },
    { file: PROPOSE_FILE, epics: propose.epics },
    { file: CLAUDE_MD_FILE, epics: claudeMd.epics },
  ].filter((source) => source.epics && Object.keys(source.epics).length > 0);

  if (epicSources.length >= 2) {
    const [reference, ...others] = epicSources;
    const referenceNames = Object.keys(reference.epics);
    for (const other of others) {
      const names = Object.keys(other.epics);
      const missing = referenceNames.filter((name) => !names.includes(name));
      const extra = names.filter((name) => !referenceNames.includes(name));
      if (missing.length > 0 || extra.length > 0) {
        problems.push(
          `Epic option names differ between ${reference.file} and ${other.file}:` +
            (missing.length > 0 ? `\n      missing from ${other.file}: ${missing.join(', ')}` : '') +
            (extra.length > 0 ? `\n      only in ${other.file}: ${extra.join(', ')}` : ''),
        );
      }
    }

    for (const name of unique(epicSources.flatMap((source) => Object.keys(source.epics))).sort()) {
      const withName = epicSources.filter((source) => source.epics[name] !== undefined);
      if (unique(withName.map((source) => source.epics[name])).length > 1) {
        problems.push(
          `Epic option "${name}" has different IDs across caches:\n` +
            withName.map((source) => `      ${source.file} → ${source.epics[name]}`).join('\n'),
        );
      }
    }
  }

  return problems;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`ERROR: Could not parse ${label}: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

  const hookPath = resolve(root, HOOK_CONFIG_FILE);
  const proposePath = resolve(root, PROPOSE_FILE);
  const claudeMdPath = resolve(root, CLAUDE_MD_FILE);

  for (const path of [hookPath, proposePath, claudeMdPath]) {
    if (!existsSync(path)) {
      console.error(`ERROR: Expected file not found: ${path}`);
      process.exit(1);
    }
  }

  const hook = parseHookConfig(readJson(hookPath, HOOK_CONFIG_FILE));
  const propose = parseProposeConfig(readJson(proposePath, PROPOSE_FILE));
  const claudeMd = parseClaudeMd(readFileSync(claudeMdPath, 'utf8'));

  const problems = compareBoardIds({ hook, propose, claudeMd });

  if (problems.length > 0) {
    console.error('ERROR: GitHub Project board-ID caches have drifted.');
    console.error('');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    console.error('');
    console.error(
      `These IDs live in ${CLAUDE_MD_FILE}, ${HOOK_CONFIG_FILE} and ${PROPOSE_FILE} because each has a`,
    );
    console.error(
      'separate consumer. A board mutation re-cuts them all at once, so refreshing only some leaves',
    );
    console.error('the project-board hook writing to a dead field (#627). Refresh all three together —');
    console.error(`see the Backup-and-restore procedure in ${CLAUDE_MD_FILE}.`);
    process.exit(1);
  }

  const epicCount = Object.keys(hook.epics).length;
  console.log(
    `OK: board IDs in sync across ${CLAUDE_MD_FILE}, ${HOOK_CONFIG_FILE}, ${PROPOSE_FILE} ` +
      `(${hook.nodeId}, ${epicCount} Epic options).`,
  );
  process.exit(0);
}

// Only run when executed directly — lets check-board-id-sync.test.mjs import the pure helpers
// above without triggering a real filesystem read + process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

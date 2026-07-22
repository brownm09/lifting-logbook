import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseHookConfig,
  parseProposeConfig,
  parseEpicOptionsTable,
  parseMilestonesTable,
  parseClaudeMd,
  compareBoardIds,
} from './check-board-id-sync.mjs';

const NODE_ID = 'PVT_kwDOTestNodeAAA';
const EPIC_FIELD = 'PVTSSF_lADOTestEpicBBB';
const STATUS_FIELD = 'PVTSSF_lADOTestStatusCCC';
const EPIC_ROWS = [
  ['Monorepo Scaffolding', 'aaaaaaaa'],
  ['CI/CD Foundation', 'bbbbbbbb'],
];
// Em dashes match the real table, which the title regex has to survive.
const MILESTONES = ['v0.1 — Foundation', 'v0.2 — Core API'];

/** A miniature CLAUDE.md carrying the same board-ID shapes as the real one. */
function claudeMdFixture(overrides = {}) {
  const {
    nodeId = NODE_ID,
    epicField = EPIC_FIELD,
    statusField = STATUS_FIELD,
    owner = 'testowner',
    number = '2',
    epicRows = EPIC_ROWS,
    milestones = MILESTONES,
    // Simulates a partial hand-edit: one of the repeated --project-id flags left stale.
    strayNodeId = nodeId,
    doneOptionId = '98236657',
    trailer = '',
  } = overrides;

  return [
    '**Project IDs (needed for CLI commands):**',
    `- Project number: \`${number}\`, owner: \`${owner}\``,
    `- Project node ID: \`${nodeId}\``,
    `- Epic field ID: \`${epicField}\``,
    '',
    '**Epic options:**',
    '',
    '| Name | Option ID |',
    '|---|---|',
    ...epicRows.map(([name, id]) => `| ${name} | \`${id}\` |`),
    '',
    // A legitimate cross-repo link: its org name must NOT be read as the project owner.
    'Context: [#627](https://github.com/brownm09/dev-env/issues/627).',
    '',
    '```bash',
    `gh project item-add ${number} --owner ${owner} --url <issue-url>`,
    `gh project item-edit --project-id ${nodeId} --id "$ITEM_ID" \\`,
    `  --field-id ${epicField} \\`,
    '  --single-select-option-id <option-id>',
    '```',
    '',
    '```bash',
    `ITEM_ID=$(gh api graphql -f query='query($number:Int!){repository(owner:"${owner}",name:"lifting-logbook"){issue(number:$number){projectItems(first:10){nodes{id project{number}}}}}}' -F number=<N> --jq '.data.repository.issue.projectItems.nodes[]|select(.project.number==${number})|.id')`,
    `gh project item-edit --project-id ${strayNodeId} --id "$ITEM_ID" \\`,
    `  --field-id ${statusField} \\`,
    `  --single-select-option-id ${doneOptionId}`,
    '```',
    '',
    '**Milestones:**',
    '',
    '| Title | Number |',
    '|---|---|',
    ...milestones.map((title, i) => `| ${title} | \`${i + 1}\` |`),
    trailer,
  ].join('\n');
}

function hookFixture(overrides = {}) {
  return {
    project_owner: 'testowner',
    project_number: '2',
    project_node_id: NODE_ID,
    epic_field_id: EPIC_FIELD,
    status_field_id: STATUS_FIELD,
    done_option_id: '98236657',
    epic_options: Object.fromEntries(EPIC_ROWS),
    milestones: [...MILESTONES],
    ...overrides,
  };
}

function proposeFixture(overrides = {}) {
  return {
    github_project: {
      number: 2,
      owner: 'testowner',
      node_id: NODE_ID,
      epic_field_id: EPIC_FIELD,
      ...overrides.github_project,
    },
    epics: overrides.epics || EPIC_ROWS.map(([name, id]) => ({ name, id })),
    milestones: overrides.milestones || [...MILESTONES],
  };
}

function compare({ hook = {}, propose = {}, claudeMd = {} } = {}) {
  return compareBoardIds({
    hook: parseHookConfig(hookFixture(hook)),
    propose: parseProposeConfig(proposeFixture(propose)),
    claudeMd: parseClaudeMd(claudeMdFixture(claudeMd)),
  });
}

// --- parseHookConfig / parseProposeConfig ---

test('parseHookConfig reads every cached board value', () => {
  const parsed = parseHookConfig(hookFixture());
  assert.equal(parsed.nodeId, NODE_ID);
  assert.equal(parsed.epicFieldId, EPIC_FIELD);
  assert.equal(parsed.statusFieldId, STATUS_FIELD);
  assert.equal(parsed.doneOptionId, '98236657');
  assert.equal(parsed.owner, 'testowner');
  assert.deepEqual(parsed.epics, Object.fromEntries(EPIC_ROWS));
});

test('parseProposeConfig folds the epics array into a name → id map', () => {
  assert.deepEqual(parseProposeConfig(proposeFixture()).epics, Object.fromEntries(EPIC_ROWS));
});

test('project number normalizes across the string/int split between the two caches', () => {
  // hook-config stores "2"; propose.json stores 2. Both must compare equal.
  assert.equal(parseHookConfig(hookFixture()).number, '2');
  assert.equal(parseProposeConfig(proposeFixture()).number, '2');
  assert.deepEqual(compare(), []);
});

test('parseProposeConfig tolerates a missing github_project block', () => {
  const parsed = parseProposeConfig({ epics: [{ name: 'A', id: 'aaaaaaaa' }] });
  assert.equal(parsed.nodeId, undefined);
  assert.deepEqual(parsed.epics, { A: 'aaaaaaaa' });
});

// --- parseEpicOptionsTable ---

test('parseEpicOptionsTable reads the rows and skips header/separator', () => {
  assert.deepEqual(parseEpicOptionsTable(claudeMdFixture()), Object.fromEntries(EPIC_ROWS));
});

test('parseEpicOptionsTable returns undefined when the marker is absent', () => {
  assert.equal(parseEpicOptionsTable('# No board section here\n'), undefined);
});

test('parseEpicOptionsTable stops at its table end and never reads Milestones rows', () => {
  // The fixture already carries a Milestones table below the Epic table; the two must not bleed.
  assert.deepEqual(parseEpicOptionsTable(claudeMdFixture()), Object.fromEntries(EPIC_ROWS));
});

test('parseMilestonesTable reads titles and ignores Epic-option rows', () => {
  assert.deepEqual(parseMilestonesTable(claudeMdFixture()), MILESTONES);
});

test('parseMilestonesTable returns undefined when the marker is absent', () => {
  assert.equal(parseMilestonesTable('# No milestones section\n'), undefined);
});

// --- parseClaudeMd ---

test('parseClaudeMd collapses the repeated node ID to one distinct value', () => {
  const parsed = parseClaudeMd(claudeMdFixture());
  assert.deepEqual(parsed.nodeIds, [NODE_ID]);
  assert.equal(parsed.declaredNodeId, NODE_ID);
  assert.deepEqual(parsed.fieldIds.sort(), [EPIC_FIELD, STATUS_FIELD].sort());
  assert.equal(parsed.declaredEpicFieldId, EPIC_FIELD);
});

test('parseClaudeMd surfaces a partially hand-edited node ID as two distinct values', () => {
  const parsed = parseClaudeMd(claudeMdFixture({ strayNodeId: 'PVT_kwDOStaleXXX' }));
  assert.equal(parsed.nodeIds.length, 2);
});

test('parseClaudeMd reads the owner from board contexts only, not from unrelated org links', () => {
  // The fixture cites github.com/brownm09/dev-env — a real cross-repo link that must not be
  // mistaken for the project owner.
  assert.deepEqual(parseClaudeMd(claudeMdFixture()).owners, ['testowner']);
});

test('parseClaudeMd reads the project number from all three board contexts', () => {
  assert.deepEqual(parseClaudeMd(claudeMdFixture()).numbers, ['2']);
});

test('parseClaudeMd skips the literal <option-id> placeholder', () => {
  assert.deepEqual(parseClaudeMd(claudeMdFixture()).optionIdsInSnippets, ['98236657']);
});

test('parsing is CRLF-safe — Windows checkouts convert CLAUDE.md line endings', () => {
  const crlf = claudeMdFixture().replace(/\n/g, '\r\n');
  const parsed = parseClaudeMd(crlf);
  assert.deepEqual(parsed.epics, Object.fromEntries(EPIC_ROWS));
  assert.deepEqual(parsed.nodeIds, [NODE_ID]);
  assert.equal(parsed.declaredEpicFieldId, EPIC_FIELD);
  assert.deepEqual(parsed.owners, ['testowner']);
  assert.deepEqual(parsed.numbers, ['2']);
});

// --- compareBoardIds ---

test('compareBoardIds reports nothing when all three caches agree', () => {
  assert.deepEqual(compare(), []);
});

test('compareBoardIds catches a divergent Epic option ID', () => {
  const problems = compare({
    propose: { epics: [{ name: 'Monorepo Scaffolding', id: 'aaaaaaaa' }, { name: 'CI/CD Foundation', id: 'deadbeef' }] },
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Epic option "CI\/CD Foundation" has different IDs/);
});

test('compareBoardIds catches a divergent project node ID', () => {
  const problems = compare({ hook: { project_node_id: 'PVT_kwDOOtherNode' } });
  assert.match(problems.join('\n'), /Project node ID disagrees across caches/);
});

test('compareBoardIds catches CLAUDE.md disagreeing with itself', () => {
  const problems = compare({ claudeMd: { strayNodeId: 'PVT_kwDOStaleXXX' } });
  assert.match(problems.join('\n'), /CLAUDE\.md disagrees with itself on the project node ID/);
});

test('compareBoardIds catches a field ID in CLAUDE.md that no longer exists in hook-config', () => {
  const problems = compare({ hook: { status_field_id: 'PVTSSF_lADORefreshedStatus' } });
  const joined = problems.join('\n');
  assert.match(joined, /are not cached in/);
  assert.match(joined, /Status field ID cached in .* never appears in/);
});

test('field-ID mismatch messages blame neither file — either side may be the stale one', () => {
  // hook-config was the cache that went stale in #627, so the wording must not assert that
  // CLAUDE.md is the deviant file.
  const joined = compare({ hook: { status_field_id: 'PVTSSF_lADORefreshedStatus' } }).join('\n');
  assert.match(joined, /one of the two is stale/);
});

test('compareBoardIds catches a renamed epic that only some caches know about', () => {
  const problems = compare({
    propose: { epics: [{ name: 'Monorepo Scaffolding', id: 'aaaaaaaa' }, { name: 'CI+CD Foundation', id: 'bbbbbbbb' }] },
  });
  assert.match(problems.join('\n'), /Epic option names differ/);
});

test('compareBoardIds catches owner drift — the half-migrated org transfer', () => {
  const problems = compare({ propose: { github_project: { owner: 'neworg' } } });
  assert.match(problems.join('\n'), /Project owner disagrees across caches/);
});

test('compareBoardIds catches a Done option ID that CLAUDE.md never uses', () => {
  const problems = compare({ hook: { done_option_id: '0112fb7c' } });
  assert.match(problems.join('\n'), /Done option ID 0112fb7c .* does not appear/);
});

test('compareBoardIds catches a milestone added to CLAUDE.md but not the JSON caches', () => {
  // The drift CLAUDE.md warns about: a milestone created via the web UI or `gh api` is not
  // produced by updateProjectV2Field, so nothing prompts a cache refresh.
  const problems = compare({
    claudeMd: { milestones: [...MILESTONES, 'v0.3 — Client Applications'] },
  });
  const joined = problems.join('\n');
  assert.match(joined, /Milestone titles differ/);
  assert.match(joined, /v0\.3 — Client Applications/);
});

test('compareBoardIds catches a milestone renamed in only one JSON cache', () => {
  const problems = compare({ propose: { milestones: ['v0.1 — Foundations', 'v0.2 — Core API'] } });
  assert.match(problems.join('\n'), /Milestone titles differ/);
});

test('compareBoardIds accepts milestones that agree across all three', () => {
  assert.deepEqual(compare(), []);
});

test('compareBoardIds reports a missing required key rather than silently passing', () => {
  const problems = compareBoardIds({
    hook: parseHookConfig({ ...hookFixture(), project_node_id: undefined }),
    propose: parseProposeConfig(proposeFixture()),
    claudeMd: parseClaudeMd(claudeMdFixture()),
  });
  assert.match(problems.join('\n'), /project_node_id is missing/);
});

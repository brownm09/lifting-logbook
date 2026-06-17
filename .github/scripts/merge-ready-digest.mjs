#!/usr/bin/env node
// merge-ready-digest.mjs — selector for the scheduled deployment-queue digest (#538).
//
// A PR is "merge-ready" when it is not a draft, is MERGEABLE, its merge state is
// CLEAN, and its check rollup has zero FAILURE/PENDING entries — i.e. it is green
// and waiting only on a deliberate in-session merge (auto-merge is off by design,
// ADR-031). This mirrors the local on-demand ~/.claude/scripts/merge-ready.sh so
// the scheduled digest and the manual check agree.
//
// Reads the JSON array emitted by:
//   gh pr list --state open --json number,title,isDraft,mergeable,mergeStateStatus,statusCheckRollup
// and writes the sticky-comment markdown body (including the upsert marker) to stdout.

import { readFileSync } from 'node:fs';

const MARKER = '<!-- merge-ready-digest -->';

// statusCheckRollup entries are a mix of CheckRun (has `conclusion`/`status`) and
// StatusContext (has `state`). Treat anything not clearly passing/failing as
// pending so an in-flight or unreported check never counts as merge-ready.
const PASS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const FAIL = new Set([
  'FAILURE',
  'ERROR',
  'TIMED_OUT',
  'CANCELLED',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]);

function rollup(checks = []) {
  const c = { ok: 0, pending: 0, fail: 0 };
  for (const x of checks) {
    const s = x.conclusion || x.status || x.state || '';
    if (PASS.has(s)) c.ok++;
    else if (FAIL.has(s)) c.fail++;
    else c.pending++; // QUEUED, IN_PROGRESS, PENDING, EXPECTED, '' ...
  }
  return c;
}

const file = process.argv[2];
if (!file) {
  console.error('usage: merge-ready-digest.mjs <prs.json>');
  process.exit(2);
}

const prs = JSON.parse(readFileSync(file, 'utf8'));

const ready = [];
const waiting = [];
for (const p of prs) {
  if (p.isDraft) continue;
  const c = rollup(p.statusCheckRollup);
  const isReady =
    p.mergeable === 'MERGEABLE' &&
    p.mergeStateStatus === 'CLEAN' &&
    c.fail === 0 &&
    c.pending === 0;
  (isReady ? ready : waiting).push({ ...p, c });
}

const lines = [MARKER, '## 🚦 Deployment queue', ''];

if (ready.length === 0) {
  lines.push('✅ **Queue clear** — no PRs are merge-ready right now.');
} else {
  lines.push(
    `**${ready.length} PR${ready.length === 1 ? '' : 's'} merge-ready** (green + mergeable, nothing pending):`,
  );
  lines.push('');
  for (const p of ready) {
    lines.push(`- #${p.number} ${p.title} — ✅ ${p.c.ok} checks`);
  }
}

if (waiting.length) {
  lines.push('');
  lines.push(
    `<details><summary>⏳ ${waiting.length} open, not yet merge-ready</summary>`,
  );
  lines.push('');
  for (const p of waiting) {
    lines.push(
      `- #${p.number} ${p.title} — \`${p.mergeStateStatus}\`/\`${p.mergeable}\` (${p.c.ok}✓ ${p.c.pending}… ${p.c.fail}✗)`,
    );
  }
  lines.push('');
  lines.push('</details>');
}

lines.push('');
lines.push(
  '<sub>Auto-maintained by `.github/workflows/merge-ready-digest.yml` (#538) — edited in place, no notifications.</sub>',
);

process.stdout.write(lines.join('\n') + '\n');

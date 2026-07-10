#!/usr/bin/env node
/**
 * Enforces that the Cloud Run otel-collector config
 * (infra/cloud-run/otel-collector-config.yaml) stays identical to the GKE
 * DaemonSet's config.yaml, which is embedded as a literal block scalar in
 * infra/kubernetes/charts/otel-collector/templates/configmap.yaml. The whole
 * premise of #782 is that GKE and Cloud Run run the *same* collector pipeline;
 * today the two files are kept in sync only by a "keep in sync" comment, so a
 * future edit to one silently diverges them. This guard fails CI on any
 * divergence. (#788 item 2 / #794; mirrors scripts/check-grafana-endpoint-sources.mjs
 * from #790.)
 *
 * The two files legitimately differ in exactly two ways, which this check
 * normalizes away before comparing:
 *   1. The Cloud Run file carries a leading '#'-comment header (describing how it
 *      is mounted on Cloud Run); the configmap block does not. => strip the header.
 *   2. The configmap embeds the config under `config.yaml: |` indented 4 spaces;
 *      the Cloud Run file sits at column 0. => dedent the block.
 * The ${env:...} placeholders and every inline comment are identical in both and
 * are compared strictly — an inline-comment edit in only one file is real drift too.
 *
 * Usage: node scripts/check-otel-config-sync.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// --- Pure helpers (exported for unit testing — see check-otel-config-sync.test.mjs) ---

export const CLOUD_RUN_FILE = 'infra/cloud-run/otel-collector-config.yaml';
export const CONFIGMAP_FILE =
  'infra/kubernetes/charts/otel-collector/templates/configmap.yaml';

// Split on LF, tolerating CRLF, and strip trailing whitespace from each line so
// EOL / trailing-space noise never reads as drift.
function toLines(text) {
  return text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
}

// Join lines back, dropping leading and trailing blank lines so a stray final
// newline in one file never reads as drift. Inner blank lines are preserved.
function normalize(lines) {
  const out = [...lines];
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/**
 * The Cloud Run file is the whole collector config prefixed by a '#'-comment
 * header. Drop the header (leading blank / comment lines) and return the config
 * body (first real key `extensions:` through EOF), normalized. Throws if the
 * file is entirely comments/blank.
 */
export function extractCloudRunBody(text) {
  const lines = toLines(text);
  let i = 0;
  while (i < lines.length && (lines[i] === '' || lines[i].trimStart().startsWith('#'))) i++;
  if (i === lines.length) {
    throw new Error(`${CLOUD_RUN_FILE}: no config body found (file is all comments/blank).`);
  }
  return normalize(lines.slice(i));
}

/**
 * Extract the `config.yaml: |` literal block scalar from the GKE configmap,
 * dedented to column 0, normalized. Throws if the block is absent or empty.
 */
export function extractConfigmapBlock(text) {
  const lines = toLines(text);
  const keyIdx = lines.findIndex((l) => /^\s*config\.yaml:\s*\|[-+]?\s*$/.test(l));
  if (keyIdx === -1) {
    throw new Error(`${CONFIGMAP_FILE}: no \`config.yaml: |\` block scalar found.`);
  }
  const keyIndent = lines[keyIdx].match(/^(\s*)/)[1].length;

  const block = [];
  for (let i = keyIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      block.push('');
      continue;
    }
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= keyIndent) break; // sibling key / '---' / end of block
    block.push(line);
  }
  const firstReal = block.find((l) => l !== '');
  if (firstReal === undefined) {
    throw new Error(`${CONFIGMAP_FILE}: \`config.yaml: |\` block is empty.`);
  }

  // Dedent every line by the indentation of the first non-blank block line.
  const blockIndent = firstReal.match(/^(\s*)/)[1].length;
  const dedented = block.map((l) => (l === '' ? '' : l.slice(blockIndent)));
  return normalize(dedented);
}

/**
 * Compare two normalized bodies line-by-line. Returns null if identical, else
 * { line, cloudRun, configmap } for the first divergence (1-based line number).
 */
export function diffConfigs(cloudRunBody, configmapBody) {
  const a = cloudRunBody.split('\n');
  const b = configmapBody.split('\n');
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return {
        line: i + 1,
        cloudRun: a[i] === undefined ? '(none — Cloud Run body is shorter here)' : a[i],
        configmap: b[i] === undefined ? '(none — configmap block is shorter here)' : b[i],
      };
    }
  }
  return null;
}

// --- CLI entrypoint ---

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const cloudRunText = readFileSync(resolve(root, CLOUD_RUN_FILE), 'utf8');
  const configmapText = readFileSync(resolve(root, CONFIGMAP_FILE), 'utf8');

  const cloudRunBody = extractCloudRunBody(cloudRunText);
  const configmapBody = extractConfigmapBlock(configmapText);

  const diff = diffConfigs(cloudRunBody, configmapBody);
  if (diff) {
    console.error('ERROR: Cloud Run otel-collector config has drifted from the GKE configmap.');
    console.error(`The pipeline body of ${CLOUD_RUN_FILE}`);
    console.error(`must match the \`config.yaml\` block in ${CONFIGMAP_FILE} (#782/#788).`);
    console.error('');
    console.error(`First divergence at config-body line ${diff.line}:`);
    console.error(`  cloud-run: ${diff.cloudRun}`);
    console.error(`  configmap: ${diff.configmap}`);
    console.error('');
    console.error('Reconcile the two files (edit both to match), then re-run this check.');
    process.exit(1);
  }

  console.log('OK: Cloud Run otel-collector config matches the GKE configmap.');
  process.exit(0);
}

// Only run when executed directly — lets the test file import the pure helpers
// without triggering a real filesystem read + process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

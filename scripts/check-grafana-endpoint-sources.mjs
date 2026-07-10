#!/usr/bin/env node
/**
 * Enforces the single source of truth for the Grafana Cloud OTLP/Loki ingest
 * endpoints (#785). The literal endpoint URLs must live ONLY in
 * infra/observability/grafana-endpoints.env; every other consumer
 * (.github/workflows/deploy.yml, the Helm values files, the Cloud Run collector
 * config) derives them from that file. This guard fails CI if a literal endpoint
 * is re-hardcoded anywhere else — the drift that produced the no-telemetry
 * incident #781.
 *
 * A line is a VIOLATION when it contains a Grafana OTLP-gateway / Loki host
 * literal (e.g. otlp-gateway-<region>.grafana.net or logs-prod-<n>.grafana.net)
 * AND:
 *   - the file is not the single source (infra/observability/grafana-endpoints.env)
 *     and not this guard's own test fixture file, AND
 *   - the file is not documentation (docs/** or *.md — prose legitimately cites
 *     region/gateway values), AND
 *   - the matching line is not a comment (a trimmed line starting with '#' or
 *     '//' — comments explaining the wiring are allowed).
 *
 * Usage: node scripts/check-grafana-endpoint-sources.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// --- Pure helpers (exported for unit testing — see check-grafana-endpoint-sources.test.mjs) ---

// Grafana Cloud OTLP-gateway and Loki-gateway host literals. The prometheus
// (Mimir) host has a different shape and is intentionally not matched — only the
// two endpoints this repo hardcodes for the collector are guarded.
export const ENDPOINT_RE = /(otlp-gateway-[a-z0-9-]+\.grafana\.net|logs-prod-\d+\.grafana\.net)/;

// The one file allowed to hold the literal endpoints.
export const SOURCE_FILE = 'infra/observability/grafana-endpoints.env';

// Files exempt from the scan. The source file holds the canonical literals; the
// guard's own test file carries fixture literals used to exercise this detector.
export const ALLOWLIST = new Set([
  SOURCE_FILE,
  'scripts/check-grafana-endpoint-sources.test.mjs',
]);

// Documentation may cite endpoint values in prose.
export function isDocFile(path) {
  return path.startsWith('docs/') || path.endsWith('.md');
}

// A comment line (after trimming leading whitespace) references the wiring
// without hardcoding a live value. Covers YAML/shell/env/python ('#') and
// JS/TS ('//') comment styles.
export function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith('#') || t.startsWith('//');
}

/**
 * Pure violation finder. `files` is an array of { path, content }.
 * Returns an array of { path, line, text }.
 */
export function findHardcodedEndpoints(files) {
  const violations = [];
  for (const { path, content } of files) {
    if (ALLOWLIST.has(path) || isDocFile(path)) continue;
    content.split(/\r?\n/).forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (ENDPOINT_RE.test(line)) {
        violations.push({ path, line: i + 1, text: line.trim() });
      }
    });
  }
  return violations;
}

// --- CLI entrypoint ---

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, '..');

  // The single source of truth must exist and define both endpoints, non-empty.
  const sourcePath = resolve(root, SOURCE_FILE);
  if (!existsSync(sourcePath)) {
    console.error(`ERROR: Missing single-source endpoint file: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const sourceContent = readFileSync(sourcePath, 'utf8');
  for (const key of ['OTEL_OTLP_ENDPOINT', 'OTEL_LOKI_ENDPOINT']) {
    if (!new RegExp(`${key}=\\S`).test(sourceContent)) {
      console.error(`ERROR: ${SOURCE_FILE} does not define a non-empty ${key}.`);
      process.exit(1);
    }
  }

  // Scan every tracked file (skip the lockfile; node_modules is untracked).
  const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => p !== 'package-lock.json');

  const files = [];
  for (const p of tracked) {
    try {
      files.push({ path: p, content: readFileSync(resolve(root, p), 'utf8') });
    } catch {
      // Unreadable/binary file — cannot contain a text endpoint literal; skip.
    }
  }

  const violations = findHardcodedEndpoints(files);
  if (violations.length > 0) {
    console.error('ERROR: Hardcoded Grafana OTLP/Loki endpoint(s) found outside the single source.');
    console.error(`The endpoints must live only in ${SOURCE_FILE}; every consumer derives them from it (#785).`);
    console.error('');
    for (const v of violations) {
      console.error(`  ${v.path}:${v.line}: ${v.text}`);
    }
    console.error('');
    console.error(`Move the value into ${SOURCE_FILE} and reference it (source the file, or helm --set-string).`);
    process.exit(1);
  }

  console.log(`OK: Grafana OTLP/Loki endpoints have a single source (${SOURCE_FILE}).`);
  process.exit(0);
}

// Only run when executed directly — lets the test file import the pure helpers
// without triggering a real filesystem scan + process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

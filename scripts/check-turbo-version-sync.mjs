#!/usr/bin/env node
/**
 * Validates that apps/web/Dockerfile's pinned `npx turbo@<version> prune` step matches
 * package.json's devDependencies.turbo. The prune step runs before `npm ci` (node_modules
 * is dockerignored ahead of it), so a bare/mismatched turbo version there has no local
 * install to prefer and would build against a different turbo release than the one locked
 * for local dev, CI, and the later `npm ci` stage of the same image. See #674 / #692.
 *
 * Usage: node scripts/check-turbo-version-sync.mjs
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// --- Pure parsing helpers (exported for unit testing — see check-turbo-version-sync.test.mjs) ---

export function extractDockerfileTurboVersion(dockerfileSource) {
  const match = dockerfileSource.match(/npx turbo@(\S+)\s+prune\b/);
  return match ? match[1] : null;
}

export function extractPackageJsonTurboVersion(pkg) {
  return (pkg.devDependencies && pkg.devDependencies.turbo) || null;
}

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, '..');

  const DOCKERFILE = resolve(root, 'apps/web/Dockerfile');
  const PACKAGE_JSON = resolve(root, 'package.json');

  for (const path of [DOCKERFILE, PACKAGE_JSON]) {
    if (!existsSync(path)) {
      console.error(`ERROR: Expected file not found: ${path}`);
      process.exit(1);
    }
  }

  const dockerfileVersion = extractDockerfileTurboVersion(readFileSync(DOCKERFILE, 'utf8'));
  if (!dockerfileVersion) {
    console.error(`ERROR: Could not find a pinned "npx turbo@<version> prune" step in ${DOCKERFILE}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  const packageJsonVersion = extractPackageJsonTurboVersion(pkg);
  if (!packageJsonVersion) {
    console.error(`ERROR: Could not read devDependencies.turbo from ${PACKAGE_JSON}`);
    process.exit(1);
  }

  if (dockerfileVersion !== packageJsonVersion) {
    console.error('ERROR: turbo version drift detected between apps/web/Dockerfile and package.json.');
    console.error(`  apps/web/Dockerfile pins:  npx turbo@${dockerfileVersion}`);
    console.error(`  package.json declares:     devDependencies.turbo = ${packageJsonVersion}`);
    console.error("\nUpdate apps/web/Dockerfile's prune step to match package.json's turbo version (or vice versa),");
    console.error('so the prune step and the later `npm ci` build against the same turbo release.');
    process.exit(1);
  }

  console.log(`OK: turbo version in sync (${dockerfileVersion}).`);
  process.exit(0);
}

// Only run when executed directly — lets check-turbo-version-sync.test.mjs import the
// pure helpers above without triggering a real filesystem read + process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

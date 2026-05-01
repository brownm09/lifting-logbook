#!/usr/bin/env node
/**
 * Validates that AnalyticsConstants.kt contains every event name defined in
 * packages/types/src/analytics.ts. Exits 0 when in sync or when the Kotlin
 * file does not yet exist (Kotlin app is future work). Exits 1 on drift.
 *
 * Usage: node scripts/validate-analytics-taxonomy.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const TS_FILE = resolve(root, 'packages/types/src/analytics.ts');
const KT_FILE = resolve(root, 'apps/mobile-kotlin/app/src/main/java/com/liftinglogbook/analytics/AnalyticsConstants.kt');

// --- Parse TypeScript event values ---

const tsSource = readFileSync(TS_FILE, 'utf8');

// Match string values inside the AnalyticsEvent const object
const tsEventBlock = tsSource.match(/export const AnalyticsEvent\s*=\s*\{([^}]+)\}/s);
if (!tsEventBlock) {
  console.error('ERROR: Could not parse AnalyticsEvent from', TS_FILE);
  process.exit(1);
}

const tsEvents = [...tsEventBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
if (tsEvents.length === 0) {
  console.error('ERROR: No event names found in AnalyticsEvent.');
  process.exit(1);
}

// --- Check Kotlin file ---

if (!existsSync(KT_FILE)) {
  console.log('INFO: AnalyticsConstants.kt not found — Kotlin app not yet scaffolded. Skipping taxonomy validation.');
  console.log(`      Expected path: ${KT_FILE}`);
  process.exit(0);
}

const ktSource = readFileSync(KT_FILE, 'utf8');

const missing = tsEvents.filter(event => !ktSource.includes(`"${event}"`));

if (missing.length > 0) {
  console.error('ERROR: Analytics taxonomy drift detected.');
  console.error('The following events are defined in packages/types/src/analytics.ts but');
  console.error('are missing from AnalyticsConstants.kt:\n');
  missing.forEach(e => console.error(`  - ${e}`));
  console.error('\nUpdate AnalyticsConstants.kt to include all event names from the TypeScript taxonomy.');
  process.exit(1);
}

console.log(`OK: All ${tsEvents.length} event names present in AnalyticsConstants.kt.`);
process.exit(0);

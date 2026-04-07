/**
 * Lint fixture test — hexagonal architecture boundary (ADR-002)
 *
 * Runs the ESLint CLI as a subprocess on inline fixture content to verify
 * that the no-restricted-imports rule configured in packages/core/eslint.config.js
 * fires on violations. This avoids the ESLint 9 dynamic-import/Jest vm conflict.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CORE_DIR = path.resolve(__dirname, '..');
// Resolve the eslint JS entry point directly — the .bin shim is a bash script
// on Windows and cannot be run via process.execPath (node).
const ESLINT_JS = require.resolve('eslint/package.json').replace('package.json', 'bin/eslint.js');
const TMP_FIXTURE = path.resolve(CORE_DIR, 'tmp_lint_boundary_fixture.ts');

function lintSnippet(code: string): { exitCode: number; output: string } {
  fs.writeFileSync(TMP_FIXTURE, code, 'utf8');
  try {
    const result = spawnSync(
      process.execPath,
      [ESLINT_JS, TMP_FIXTURE, '--no-ignore'],
      { cwd: CORE_DIR, encoding: 'utf8' },
    );
    return {
      exitCode: result.status ?? 1,
      output: (result.stdout ?? '') + (result.stderr ?? ''),
    };
  } finally {
    if (fs.existsSync(TMP_FIXTURE)) fs.unlinkSync(TMP_FIXTURE);
  }
}

afterAll(() => {
  if (fs.existsSync(TMP_FIXTURE)) fs.unlinkSync(TMP_FIXTURE);
});

describe('packages/core hexagonal boundary (ADR-002)', () => {
  it('flags an import of an ORM package (@prisma/client)', () => {
    const { exitCode, output } = lintSnippet(`import { PrismaClient } from '@prisma/client';\n`);
    expect(exitCode).not.toBe(0);
    expect(output).toMatch('no-restricted-imports');
  });

  it('flags an import of an HTTP server framework (express)', () => {
    const { exitCode, output } = lintSnippet(`import express from 'express';\n`);
    expect(exitCode).not.toBe(0);
    expect(output).toMatch('no-restricted-imports');
  });

  it('flags an import of an HTTP client library (axios)', () => {
    const { exitCode, output } = lintSnippet(`import axios from 'axios';\n`);
    expect(exitCode).not.toBe(0);
    expect(output).toMatch('no-restricted-imports');
  });

  it('flags an import of an auth library (jsonwebtoken)', () => {
    const { exitCode, output } = lintSnippet(`import jwt from 'jsonwebtoken';\n`);
    expect(exitCode).not.toBe(0);
    expect(output).toMatch('no-restricted-imports');
  });

  it('flags an import of a cloud SDK (@google-cloud/storage)', () => {
    const { exitCode, output } = lintSnippet(`import { Storage } from '@google-cloud/storage';\n`);
    expect(exitCode).not.toBe(0);
    expect(output).toMatch('no-restricted-imports');
  });

  it('does not flag an import from @lifting-logbook/types', () => {
    const { output } = lintSnippet(`import type { Workout } from '@lifting-logbook/types';\n`);
    // Only assert that no-restricted-imports did not fire — other rules (e.g.
    // no-unused-vars) are irrelevant to the boundary being tested here.
    expect(output).not.toMatch('no-restricted-imports');
  });
});

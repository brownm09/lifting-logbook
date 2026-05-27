'use strict';

const { RuleTester } = require('eslint');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const rule = require('./no-uncovered-error-fallback');

// RuleTester needs a parser that understands TS. We use @typescript-eslint/parser
// resolved from the monorepo root (the eslint-rules workspace doesn't depend on it
// directly to keep it small; the root devDependency satisfies it).
const tsParser = require('@typescript-eslint/parser');

// Build a fake repo-root sandbox per test so `findRepoRoot` and the reference scan
// resolve into our fixture, not into the real lifting-logbook repo (which would
// poison the module-level cache for subsequent cases).
function makeSandbox(testFiles) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-rule-test-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"sandbox","private":true}');
  fs.writeFileSync(path.join(root, 'turbo.json'), '{}');
  for (const [rel, content] of Object.entries(testFiles)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function clearRuleCache() {
  // Force the rule module to rebuild its cache for the next sandbox by re-requiring.
  delete require.cache[require.resolve('./no-uncovered-error-fallback')];
}

function runCases({ sandboxFiles, sourceRel, code, expectErrors }) {
  clearRuleCache();
  const freshRule = require('./no-uncovered-error-fallback');
  const root = makeSandbox(sandboxFiles);
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs), { recursive: true });
  fs.writeFileSync(sourceAbs, code);

  const tester = new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
  });

  if (expectErrors.length === 0) {
    tester.run('no-uncovered-error-fallback', freshRule, {
      valid: [{ code, filename: sourceAbs }],
      invalid: [],
    });
  } else {
    tester.run('no-uncovered-error-fallback', freshRule, {
      valid: [],
      invalid: [{ code, filename: sourceAbs, errors: expectErrors }],
    });
  }

  fs.rmSync(root, { recursive: true, force: true });
}

test('bare .catch(() => []) with no test reference is flagged', () => {
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts': '// just a test, no references\n',
    },
    sourceRel: 'apps/web/app/page.tsx',
    code: 'export const x = Promise.resolve(1).catch(() => []);\n',
    expectErrors: [{ messageId: 'uncovered' }],
  });
});

test('.catch(() => []) is accepted when a test comment names the file:line', () => {
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts':
        '// covers fallback at apps/web/app/page.tsx:1\ntest("x", () => {});\n',
    },
    sourceRel: 'apps/web/app/page.tsx',
    code: 'export const x = Promise.resolve(1).catch(() => []);\n',
    expectErrors: [],
  });
});

test('allow-skewed comment opts out', () => {
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts': '\n',
    },
    sourceRel: 'apps/web/app/page.tsx',
    code:
      '// allow-skewed: shutdown handler, no business path\n' +
      'export const x = Promise.resolve(1).catch(() => undefined);\n',
    expectErrors: [],
  });
});

test('fallback-covered-by pointing at an existing file is accepted', () => {
  runCases({
    sandboxFiles: {
      'apps/api/src/foo.spec.ts': '// hi\n',
    },
    sourceRel: 'apps/api/src/foo.ts',
    code:
      '// fallback-covered-by: apps/api/src/foo.spec.ts\n' +
      'export const x = Promise.resolve(1).catch(() => []);\n',
    expectErrors: [],
  });
});

test('fallback-covered-by pointing at a missing file is rejected', () => {
  runCases({
    sandboxFiles: {
      'apps/api/src/foo.spec.ts': '// hi\n',
    },
    sourceRel: 'apps/api/src/foo.ts',
    code:
      '// fallback-covered-by: apps/api/src/nope.spec.ts\n' +
      'export const x = Promise.resolve(1).catch(() => []);\n',
    expectErrors: [{ messageId: 'missingTarget' }],
  });
});

test('try/catch/redirect bare is flagged', () => {
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts': '\n',
    },
    sourceRel: 'apps/web/app/x/page.tsx',
    code:
      'declare function redirect(s: string): never;\n' +
      'export async function P(){ try { await Promise.resolve(1); } catch { redirect("/x"); } }\n',
    expectErrors: [{ messageId: 'uncovered' }],
  });
});

test('try/catch/redirect referenced by a test comment is accepted', () => {
  // Source line range of the TryStatement is lines 2-2.
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts': '// see apps/web/app/x/page.tsx:2\n',
    },
    sourceRel: 'apps/web/app/x/page.tsx',
    code:
      'declare function redirect(s: string): never;\n' +
      'export async function P(){ try { await Promise.resolve(1); } catch { redirect("/x"); } }\n',
    expectErrors: [],
  });
});

test('.catch that re-throws is not matched', () => {
  runCases({
    sandboxFiles: {
      'apps/api/src/foo.spec.ts': '\n',
    },
    sourceRel: 'apps/api/src/foo.ts',
    code:
      'export const x = Promise.resolve(1).catch((e) => { console.error(e); throw e; });\n',
    expectErrors: [],
  });
});

test('controller conditional re-throw with neutral default is matched', () => {
  runCases({
    sandboxFiles: {
      'apps/api/src/foo.spec.ts': '\n',
    },
    sourceRel: 'apps/api/src/foo.ts',
    code:
      'class NotFound extends Error {}\n' +
      'export const x = Promise.resolve(1).catch((err: unknown) => { if (err instanceof NotFound) return []; throw err; });\n',
    expectErrors: [{ messageId: 'uncovered' }],
  });
});

test('range references match any line in the fallback node', () => {
  runCases({
    sandboxFiles: {
      'apps/web/e2e/smoke.spec.ts':
        '// covers apps/web/app/page.tsx:1-5\n',
    },
    sourceRel: 'apps/web/app/page.tsx',
    code:
      'export const x = Promise.resolve(1)\n' +
      '  .catch(\n' +
      '    () => []\n' +
      '  );\n',
    expectErrors: [],
  });
});


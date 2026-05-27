'use strict';

const fs = require('fs');
const path = require('path');

const TEST_GLOB_DIRS = [
  'apps/web/e2e',
  'apps/web/src',
  'apps/api/src',
  'apps/api-legacy/src',
  'packages',
];

const TEST_FILE_SUFFIXES = ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx'];

let cachedReferences = null;
let cachedRepoRoot = null;

function findRepoRoot(startDir) {
  // The repo root is the directory containing `.git` (a directory in a normal clone,
  // a file in a git worktree). In test sandboxes we fall back to a `package.json` +
  // `turbo.json` pair. We always walk to the top so that nested package.json files
  // (e.g. apps/web/package.json) don't shadow the monorepo root.
  let dir = startDir;
  let bestPkgTurbo = null;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'turbo.json'))) {
      bestPkgTurbo = dir;
    }
    dir = path.dirname(dir);
  }
  return bestPkgTurbo;
}

function walkForTestFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo' || entry.name === '.next') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkForTestFiles(full, out);
    } else if (entry.isFile() && TEST_FILE_SUFFIXES.some((s) => entry.name.endsWith(s))) {
      out.push(full);
    }
  }
}

function collectReferencesFromText(text, refSet) {
  // Match path-like tokens followed by :line or :line-line. Path component allows
  // forward-slashed posix style as written in source comments.
  const re = /([a-zA-Z0-9._\-/]+\.[a-zA-Z0-9]+):(\d+)(?:-(\d+))?/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const [, refPath, startStr, endStr] = match;
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : start;
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    for (let line = start; line <= end; line++) {
      refSet.add(`${refPath}:${line}`);
    }
  }
}

function buildReferenceSet(repoRoot) {
  const refSet = new Set();
  for (const rel of TEST_GLOB_DIRS) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const files = [];
    walkForTestFiles(abs, files);
    for (const file of files) {
      let contents;
      try {
        contents = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      collectReferencesFromText(contents, refSet);
    }
  }
  return refSet;
}

function getReferences(filename) {
  const repoRoot = findRepoRoot(path.dirname(filename));
  if (!repoRoot) return { repoRoot: null, refs: new Set() };
  if (cachedRepoRoot !== repoRoot) {
    cachedRepoRoot = repoRoot;
    cachedReferences = buildReferenceSet(repoRoot);
  }
  return { repoRoot, refs: cachedReferences };
}

function isNeutralReturnValue(node) {
  if (!node) return false;
  if (node.type === 'Literal') return true;
  if (node.type === 'ArrayExpression') return true;
  if (node.type === 'ObjectExpression') return true;
  if (node.type === 'Identifier') return true;
  if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') {
    return isNeutralReturnValue(node.expression);
  }
  return false;
}

function arrowReturnsNeutralDefault(arrow) {
  if (!arrow) return false;
  if (arrow.type !== 'ArrowFunctionExpression' && arrow.type !== 'FunctionExpression') return false;
  const body = arrow.body;
  if (!body) return false;
  if (body.type !== 'BlockStatement') {
    return isNeutralReturnValue(body);
  }
  // Block body: must contain at least one ReturnStatement whose argument is a neutral default.
  // The branch may also contain conditional throws (controller `if (err instanceof X) return …; throw err;`);
  // we treat that as a matched fallback for the success-default branch.
  let sawNeutralReturn = false;
  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement' && isNeutralReturnValue(stmt.argument)) {
      sawNeutralReturn = true;
    }
    if (stmt.type === 'IfStatement') {
      const consequent = stmt.consequent;
      if (consequent && consequent.type === 'BlockStatement') {
        for (const inner of consequent.body) {
          if (inner.type === 'ReturnStatement' && isNeutralReturnValue(inner.argument)) {
            sawNeutralReturn = true;
          }
        }
      } else if (consequent && consequent.type === 'ReturnStatement' && isNeutralReturnValue(consequent.argument)) {
        sawNeutralReturn = true;
      }
    }
  }
  return sawNeutralReturn;
}

function tryHandlerCallsRedirect(handler) {
  if (!handler || !handler.body || handler.body.type !== 'BlockStatement') return false;
  for (const stmt of handler.body.body) {
    if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'CallExpression' &&
      stmt.expression.callee.type === 'Identifier' &&
      stmt.expression.callee.name === 'redirect'
    ) {
      return true;
    }
  }
  return false;
}

function findAnnotation(comments) {
  for (const c of comments) {
    const text = c.value.trim();
    if (text.startsWith('allow-skewed')) return { kind: 'allow', text };
    if (text.startsWith('fallback-covered-by:')) {
      const target = text.substring('fallback-covered-by:'.length).trim();
      return { kind: 'covered-by', text, target };
    }
  }
  return null;
}

// Comments may sit immediately before the .catch() CallExpression, or before any
// ancestor (Promise.all([...]) array element, the enclosing variable declaration,
// or the export statement). Gather candidate comments from all of those positions.
function gatherCandidateComments(sourceCode, node) {
  const seen = new Set();
  const out = [];
  let current = node;
  while (current) {
    const before = sourceCode.getCommentsBefore(current);
    for (const c of before) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    current = current.parent;
  }
  return out;
}

function toPosixRepoRel(filename, repoRoot) {
  return path.relative(repoRoot, filename).split(path.sep).join('/');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require every error-swallowing fallback in scoped source files to be referenced by a test-file comment, or annotated with allow-skewed / fallback-covered-by.',
    },
    schema: [],
    messages: {
      uncovered:
        'Error-swallowing fallback at {{file}}:{{line}} is not referenced by any test file comment, and carries no allow-skewed or fallback-covered-by annotation. See docs/standards/error-fallback-test-coverage.md.',
      missingTarget:
        'fallback-covered-by points at "{{target}}" which does not exist on disk.',
    },
  },
  create(context) {
    const filename = context.getFilename ? context.getFilename() : context.filename;
    if (!filename || filename === '<input>' || filename === '<text>') return {};
    const { repoRoot, refs } = getReferences(filename);
    if (!repoRoot) return {};
    const posixRel = toPosixRepoRel(filename, repoRoot);
    const sourceCode = context.getSourceCode ? context.getSourceCode() : context.sourceCode;

    function reportIfUncovered(node) {
      const startLine = node.loc.start.line;
      const endLine = node.loc.end.line;
      const commentsBefore = gatherCandidateComments(sourceCode, node);
      const annotation = findAnnotation(commentsBefore);
      if (annotation) {
        if (annotation.kind === 'allow') return;
        if (annotation.kind === 'covered-by') {
          const targetAbs = path.isAbsolute(annotation.target)
            ? annotation.target
            : path.join(repoRoot, annotation.target);
          if (fs.existsSync(targetAbs)) return;
          context.report({
            node,
            messageId: 'missingTarget',
            data: { target: annotation.target },
          });
          return;
        }
      }
      for (let line = startLine; line <= endLine; line++) {
        if (refs.has(`${posixRel}:${line}`)) return;
      }
      context.report({
        node,
        messageId: 'uncovered',
        data: { file: posixRel, line: String(startLine) },
      });
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'catch' &&
          node.arguments.length >= 1 &&
          arrowReturnsNeutralDefault(node.arguments[0])
        ) {
          reportIfUncovered(node);
        }
      },
      TryStatement(node) {
        if (tryHandlerCallsRedirect(node.handler)) {
          reportIfUncovered(node);
        }
      },
    };
  },
};

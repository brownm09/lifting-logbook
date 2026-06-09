'use strict';

// Require an explicit cache directive on every fetch() call in scoped (apps/web) files.
//
// Next.js reversed the default fetch() caching behaviour between v14 and v15, so relying on
// the default is a latent correctness bug (see docs/standards/fetch-cache-semantics.md). The
// previous guard was a `no-restricted-syntax` selector matching only single-argument calls
// (`fetch(url)`); it could not inspect a two-argument call's options object, so
// `fetch(url, { method: 'POST' })` with no cache slipped through. This rule closes that gap:
// it flags zero/one-argument calls AND two-argument calls whose options object literal omits
// both `cache` and `next`.
//
// Deliberate non-flags (avoid false positives the rule cannot resolve statically):
//   - options object containing a spread (`{ ...init }`) — the spread may carry cache/next at
//     runtime, as in the apiFetch/clientFetch wrappers.
//   - second argument that is not an object literal (a variable, call, etc.) — not statically
//     inspectable.

function unwrap(node) {
  // Unwrap `expr as T` / `<T>expr` so `{ next: { revalidate: 3600 } } as RequestInit` is still
  // recognised as an object literal.
  while (node && (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion')) {
    node = node.expression;
  }
  return node;
}

function objectSpecifiesCache(obj) {
  for (const prop of obj.properties) {
    // A spread may carry `cache`/`next` at runtime — can't verify statically, so treat the
    // call as covered to avoid false-positiving wrapper functions like apiFetch.
    if (prop.type === 'SpreadElement' || prop.type === 'ExperimentalSpreadProperty') {
      return true;
    }
    if (prop.type === 'Property' && !prop.computed) {
      const key = prop.key;
      const name =
        key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null;
      if (name === 'cache' || name === 'next') return true;
    }
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an explicit cache option ({ cache } or { next }) on every fetch() call in apps/web. See docs/standards/fetch-cache-semantics.md.',
    },
    schema: [],
    messages: {
      missing:
        "fetch() must include an explicit cache option. Add { cache: 'no-store' } or { next: { revalidate: N } }. See docs/standards/fetch-cache-semantics.md.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Only bare `fetch(...)`, not `something.fetch(...)`.
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'fetch') return;

        if (node.arguments.length < 2) {
          context.report({ node, messageId: 'missing' });
          return;
        }

        const second = unwrap(node.arguments[1]);
        if (!second || second.type !== 'ObjectExpression') return; // not statically inspectable
        if (!objectSpecifiesCache(second)) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

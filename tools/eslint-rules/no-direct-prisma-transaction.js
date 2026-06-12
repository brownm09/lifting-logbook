'use strict';

// Prevent direct .$transaction() calls outside the two designated files.
//
// The RLS interceptor (rls.interceptor.ts) owns the one per-request interactive transaction, and
// rls-context.service.ts owns the short-lived per-operation transaction for @SkipRlsTransaction()
// handlers. Callers that need transactional behaviour must use runBatch/runInteractive from
// prisma-tx.util.ts. A raw .$transaction() call outside these files would bypass the RLS GUC setup
// and either silently run without row-level security or open a nested transaction that Prisma does
// not support on an interactive-transaction client.
//
// Allowlist: any filename ending with 'prisma-tx.util.ts', 'rls.interceptor.ts', or
// 'rls-context.service.ts'.

const ALLOWLISTED_SUFFIXES = [
  'prisma-tx.util.ts',
  'rls.interceptor.ts',
  'rls-context.service.ts',
];

function isAllowlisted(filename) {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, '/');
  return ALLOWLISTED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid calling .$transaction() directly outside prisma-tx.util.ts and rls.interceptor.ts.',
    },
    schema: [],
    messages: {
      noDirectTransaction:
        'Call `.$transaction()` directly only in `prisma-tx.util.ts`, `rls.interceptor.ts`, or ' +
        '`rls-context.service.ts`. Use `runBatch` or `runInteractive` from `prisma-tx.util.ts` instead.',
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename());
    if (isAllowlisted(filename)) return {};

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === '$transaction'
        ) {
          context.report({ node, messageId: 'noDirectTransaction' });
        }
      },
    };
  },
};

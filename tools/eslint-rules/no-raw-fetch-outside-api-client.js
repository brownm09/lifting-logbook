'use strict';

// Forbid raw fetch() to the API and hand-built auth headers in apps/web outside the typed
// api-client. Flag 6 of the 2026-06-08 architecture review (#464 / #494).
//
// #466/#479 consolidated all web HTTP access into packages/api-client's createApiClient(),
// which encapsulates the X-Clerk-Authorization (server, Cloud Run IAM) vs Authorization
// (browser) split and merges auth headers with auth-wins precedence. Nothing yet *prevents* a
// future contributor from writing a raw fetch() to the API the "obvious" way and getting a 403
// behind Cloud Run IAM. This rule is the lint-rule half of flag 6 (the loud-comment half
// already lives in the wrappers + CONTRIBUTING.md).
//
// Two detectors, both scoped to apps/web by eslint.config.js:
//   1. bare `fetch(...)` calls — must go through the typed client instead;
//   2. object-literal properties keyed `Authorization` / `X-Clerk-Authorization` — these
//      headers are owned by the api-client; hand-building them elsewhere is the footgun.
//
// Allowlisted files (they ARE the wrappers / a legitimate non-API fetch):
//   - apps/web/lib/api.ts, apps/web/lib/client-api.ts — the two createApiClient() wrappers.
//   - apps/web/lib/gcp-identity-token.ts — fetches the GCP metadata server (not the API) and
//     builds a `Metadata-Flavor` header, not an auth header.
// packages/api-client lives outside the apps/web lint scope, so the actual fetch() inside
// createApiClient() is never seen by this rule.

const ALLOWLISTED_SUFFIXES = [
  'apps/web/lib/api.ts',
  'apps/web/lib/client-api.ts',
  'apps/web/lib/gcp-identity-token.ts',
];

// Header names are compared case-insensitively (HTTP headers are case-insensitive).
const AUTH_HEADER_NAMES = new Set(['authorization', 'x-clerk-authorization']);

function isAllowlisted(filename) {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, '/');
  return ALLOWLISTED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

// Returns the lower-cased static property name, or null for spreads / computed / non-static keys.
function staticPropName(prop) {
  if (prop.type !== 'Property' || prop.computed) return null;
  const key = prop.key;
  const name = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null;
  return typeof name === 'string' ? name.toLowerCase() : null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid raw fetch() to the API and hand-built Authorization / X-Clerk-Authorization headers in apps/web outside packages/api-client. Route API calls through the typed client (createApiClient).',
    },
    schema: [],
    messages: {
      rawFetch:
        'Do not call fetch() directly in apps/web. Route API calls through the typed client in packages/api-client (via lib/api.ts / lib/client-api.ts) so Cloud Run IAM / Clerk auth headers are applied with auth-wins precedence. A raw fetch() to the API 403s behind Cloud Run IAM.',
      authHeader:
        'Do not hand-build an "{{ name }}" header in apps/web. The typed api-client owns Authorization / X-Clerk-Authorization (auth-wins merge); constructing it manually bypasses that and risks a 403 behind Cloud Run IAM.',
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename());
    if (isAllowlisted(filename)) return {};

    return {
      CallExpression(node) {
        // Only bare `fetch(...)`, not `something.fetch(...)`.
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          context.report({ node, messageId: 'rawFetch' });
        }
      },
      ObjectExpression(node) {
        for (const prop of node.properties) {
          const name = staticPropName(prop);
          if (name && AUTH_HEADER_NAMES.has(name)) {
            context.report({
              node: prop,
              messageId: 'authHeader',
              data: { name: name === 'authorization' ? 'Authorization' : 'X-Clerk-Authorization' },
            });
          }
        }
      },
    };
  },
};

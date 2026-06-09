# `@lifting-logbook/eslint-rules`

Custom ESLint rules for this monorepo. A workspace rather than inline rules in
[`eslint.config.js`](../../eslint.config.js) so each rule can carry its own
RuleTester suite without polluting the root.

## Rules

### `lifting-logbook/no-uncovered-error-fallback`

Scoped to `apps/web/app/**/*.{ts,tsx}` and `apps/api/src/**/*.ts` via
`eslint.config.js`. For every `.catch(arrow returning a neutral default)` or
`try { … } catch { redirect(…) }`, the rule requires **one** of three forms of
test coverage to be in place:

#### 1. Test-file `<path>:<line>` reference

A comment in any `*.spec.ts(x)` / `*.test.ts(x)` under `apps/web/e2e`,
`apps/web/src`, `apps/api/src`, or `packages` that names
the fallback's source location. Either a single line or a range works:

```ts
// apps/web/e2e/staging.spec.ts
test('history page renders both tabs', async ({ page }) => {
  // covers fallback at apps/web/app/history/page.tsx:37-38 — structure-only
  // assertion is acceptable because the test user has no records and the
  // fallback shape is identical to the empty success case.
  await page.goto('/history');
  await expect(page.getByRole('tab', { name: 'Lift History' })).toBeVisible();
});
```

#### 2. `// allow-skewed: <reason>` opt-out

For fallbacks with no business path to assert against (e.g., shutdown
handlers). The comment may sit immediately before the fallback or before any
ancestor expression/statement:

```ts
// allow-skewed: SIGTERM/SIGINT shutdown handler — no business path to assert against.
sdk?.shutdown().catch(() => undefined);
```

#### 3. `// fallback-covered-by: <path-to-spec-file>` pointer

For controller / service specs that exercise both branches directly, where a
`<path>:<line>` reference would be awkward. The rule verifies the named spec
file exists on disk; it does **not** verify that the spec actually exercises
both branches — that remains a reviewer responsibility (see the standard doc).

```ts
// fallback-covered-by: apps/api/src/programs/workouts.controller.spec.ts
workoutSkipOverride.getSkipsForCycle(program, dashboard.cycleNum).catch((err: unknown) => {
  console.error('[WorkoutsController] getSkipsForCycle failed; defaulting to empty set', err);
  return new Set<number>();
});
```

#### Notes and limitations

- **Ancestor-comment blast radius.** When a comment sits above an ancestor of the
  fallback (e.g., above the enclosing `const [...] = await Promise.all([...])`),
  it opts out **every** `.catch()` inside that statement. To annotate granularly,
  place the comment immediately before the specific `.catch()`.
- **Cache behavior.** The reference set is built once per ESLint process. This is
  correct for `npm run lint` but means IDE / `--fix --watch` workflows will not
  pick up newly-added test comments until the editor language-server restarts.
- **What counts as "neutral default".** `Literal`, `ArrayExpression`,
  `ObjectExpression`, any `Identifier`, and any TS type-assertion wrapping one of
  the above. `NewExpression` (e.g., `new Set()`) is intentionally **not**
  matched today — see the standard doc for current scope.
- **Aliased `redirect` imports** (`import { redirect as nextRedirect }`) are
  not detected. Bare `redirect(...)` and `something.redirect(...)` are.

### `lifting-logbook/require-fetch-cache`

Scoped to `apps/web/**/*.{ts,tsx}` (spec/test files ignored) via
[`eslint.config.js`](../../eslint.config.js). Next.js reversed the default
`fetch()` caching behaviour between v14 and v15, so relying on the default is a
latent correctness bug (see
[`docs/standards/fetch-cache-semantics.md`](../../docs/standards/fetch-cache-semantics.md)).
This rule requires every `fetch()` call to carry an explicit cache directive.

It flags:

- **Zero/one-argument calls** — `fetch(url)` (no options object at all).
- **Two-argument calls whose options object literal omits both `cache` and
  `next`** — e.g. `fetch(url, { method: 'POST' })`. This is the gap the previous
  `no-restricted-syntax` selector (which matched only single-argument calls)
  could not catch.

Deliberate non-flags (cannot be verified statically, so left to code review):

- **Options object containing a spread** (`fetch(url, { ...init })`) — the spread
  may carry `cache`/`next` at runtime, as in the `apiFetch` / `clientFetch`
  wrappers.
- **Second argument that is not an object literal** (`fetch(url, init)`) — a
  variable or call expression is not statically inspectable. A TS type assertion
  (`{ next: { revalidate: 60 } } as RequestInit`) **is** unwrapped to the object
  literal underneath and inspected.

> **Lint-scope caveat.** The web workspace lint script is `eslint app`, so
> `apps/web/lib/*.ts` is not currently linted in CI — this rule only effectively
> runs against `apps/web/app`. Widening that scope is tracked in
> [#473](https://github.com/brownm09/lifting-logbook/issues/473).

## Adding a new rule

1. Write `tools/eslint-rules/my-new-rule.js` exporting an ESLint rule module
   (with `meta`, `create`).
2. Register it in [`index.js`](./index.js):

   ```js
   const myNewRule = require('./my-new-rule');
   module.exports = {
     rules: {
       'no-uncovered-error-fallback': require('./no-uncovered-error-fallback'),
       'my-new-rule': myNewRule,
     },
   };
   ```

3. Wire it into [`../../eslint.config.js`](../../eslint.config.js) — add it
   to the existing `lifting-logbook` plugin block, scoped via `files` to the
   directories where it should apply.
4. Add a RuleTester suite alongside the rule
   (`tools/eslint-rules/my-new-rule.test.js`) and register the test file in
   the [`package.json`](./package.json) `test` script.
5. Document the rule in this README under `## Rules`.

## Running the tests

```bash
npm test -w @lifting-logbook/eslint-rules
```

The suite uses Node's built-in `node:test` runner plus ESLint's `RuleTester`,
with `@typescript-eslint/parser` for TS source. Each test case builds a
disposable sandbox under `os.tmpdir()` so the rule's module-level cache cannot
leak between cases.

## Related

- [`docs/standards/error-fallback-test-coverage.md`](../../docs/standards/error-fallback-test-coverage.md) — the standard the rule enforces
- [`eslint.config.js`](../../eslint.config.js) — where rules are wired into the lint pipeline
- [#349](https://github.com/brownm09/lifting-logbook/issues/349) — the audit that produced the standard
- [#353](https://github.com/brownm09/lifting-logbook/issues/353) — the static-check enforcement
- [#354](https://github.com/brownm09/lifting-logbook/issues/354) — follow-up audit extending scope to `packages/`

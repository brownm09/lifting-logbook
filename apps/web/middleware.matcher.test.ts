/**
 * @jest-environment node
 *
 * Locks down the Clerk middleware matcher's negative-lookahead behavior.
 *
 * Without this test, a future "simplify" of the regex (e.g., dropping the
 * `(?:\?|$)` anchor and excluding bare `healthz`) would silently widen the
 * auth bypass to /healthzfoo, /healthz-admin, etc. The deploy-time smoke only
 * verifies the positive case (/healthz returns 200), not the negative one
 * (/healthzfoo must still be auth-gated).
 *
 * See #402 (the original bypass) and #405 (this test + tightened anchor).
 */
import { config } from './middleware';

const matcherSource = config.matcher[0];
// Next.js feeds this string to path-to-regexp internally; for the negative-
// lookahead semantics we care about here, compiling it directly as a JS regex
// with start/end anchors is equivalent. This test asserts the matcher's
// regex-level behavior, not Next.js's full route resolution.
const matcher = new RegExp(`^${matcherSource}$`);

describe('clerkMiddleware matcher — /healthz bypass scope', () => {
  describe('paths that should BYPASS Clerk (matcher must not match)', () => {
    test.each([
      ['/healthz'],
      ['/healthz?ping=1'],
      ['/healthz?foo=bar&baz=1'],
      // /healthz/* subpaths bypass too under the #404 anchor, restored as
      // part of the #409 hypothesis-A bisection. The narrower #405 anchor
      // (which auth-protected /healthz/*) coincided with the runtime
      // route-dispatch 404; the tightening will return once #409 is
      // resolved with a path-segment-aware pattern.
      ['/healthz/admin'],
      ['/healthz/sub'],
    ])('%s is excluded', (path) => {
      expect(matcher.test(path)).toBe(false);
    });
  });

  describe('paths that should ENTER Clerk (matcher must match)', () => {
    test.each([
      ['/'],
      ['/sign-in'],
      ['/dashboard'],
      // The critical negatives — these all start with "healthz" but are NOT
      // the /healthz liveness probe. A regression to bare `healthz` exclusion
      // would silently make these public.
      ['/healthzfoo'],
      ['/healthz-admin'],
      ['/healthzz'],
    ])('%s is included', (path) => {
      expect(matcher.test(path)).toBe(true);
    });
  });

  describe('static assets — sanity check that pre-existing exclusions still work', () => {
    test.each([
      ['/_next/static/chunk.js'],
      ['/favicon.ico'],
      ['/logo.png'],
      ['/styles.css'],
    ])('%s is excluded', (path) => {
      expect(matcher.test(path)).toBe(false);
    });
  });
});

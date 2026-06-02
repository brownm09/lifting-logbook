/**
 * @jest-environment node
 *
 * Locks down the Clerk middleware matcher's negative-lookahead behavior.
 *
 * Without this test, a future "simplify" of the regex (e.g., dropping the
 * `(?:\?|$)` anchor and excluding bare `livez`) would silently widen the
 * auth bypass to /livezfoo, /livez-admin, etc. The deploy-time smoke only
 * verifies the positive case (/livez returns 200), not the negative one
 * (/livezfoo must still be auth-gated).
 *
 * See #402 (the original bypass on /healthz), #405 (tightened anchor), and
 * #409 (rename /healthz → /livez because GFE intercepts /healthz on Cloud Run).
 */
import { config } from './middleware';

const matcherSource = config.matcher[0];
// Next.js feeds this string to path-to-regexp internally; for the negative-
// lookahead semantics we care about here, compiling it directly as a JS regex
// with start/end anchors is equivalent. This test asserts the matcher's
// regex-level behavior, not Next.js's full route resolution.
const matcher = new RegExp(`^${matcherSource}$`);

describe('clerkMiddleware matcher — /livez bypass scope', () => {
  describe('paths that should BYPASS Clerk (matcher must not match)', () => {
    test.each([['/livez'], ['/livez?ping=1'], ['/livez?foo=bar&baz=1']])(
      '%s is excluded',
      (path) => {
        expect(matcher.test(path)).toBe(false);
      },
    );
  });

  describe('paths that should ENTER Clerk (matcher must match)', () => {
    test.each([
      ['/'],
      ['/sign-in'],
      ['/dashboard'],
      // The critical negatives — these all start with "livez" but are NOT
      // the /livez liveness probe. A regression to bare `livez` exclusion
      // would silently make these public.
      ['/livezfoo'],
      ['/livez-admin'],
      ['/livezz'],
      // Nested /livez/* subpaths must enter Clerk so any future
      // /livez/admin route is auth-gated by default (#405).
      ['/livez/admin'],
      ['/livez/sub'],
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

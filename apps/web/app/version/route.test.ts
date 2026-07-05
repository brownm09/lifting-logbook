/**
 * @jest-environment node
 */
import { GET, resolveEnvironment } from './route';

describe('resolveEnvironment', () => {
  it('uses NODE_ENV verbatim when set', () => {
    expect(resolveEnvironment('production')).toBe('production');
    expect(resolveEnvironment('staging')).toBe('staging');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveEnvironment('  staging  ')).toBe('staging');
  });

  it('falls back to "development" when the value is blank', () => {
    expect(resolveEnvironment('')).toBe('development');
    expect(resolveEnvironment('   ')).toBe('development');
  });

  // Note: resolveEnvironment(undefined) is NOT a meaningful test case here —
  // JS default parameters apply whenever the argument is `undefined`, so an
  // explicit `undefined` is indistinguishable from omitting the argument
  // entirely, which falls through to the live process.env.NODE_ENV (whatever
  // Jest set it to), not a true "unset" case. Mirrors the equivalent
  // omission in apps/api/src/otel.spec.ts's resolveDeploymentEnvironment
  // tests, which test the blank-string case above instead.
});

describe('/version GET', () => {
  const originalGitSha = process.env.GIT_SHA;

  afterEach(() => {
    if (originalGitSha === undefined) {
      delete process.env.GIT_SHA;
    } else {
      process.env.GIT_SHA = originalGitSha;
    }
  });

  it('returns the GIT_SHA from process.env and the resolved environment', async () => {
    process.env.GIT_SHA = 'abc1234';

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      gitSha: 'abc1234',
      environment: resolveEnvironment(),
    });
  });

  it('degrades to gitSha "unknown" when GIT_SHA is not set, rather than throwing', async () => {
    delete process.env.GIT_SHA;

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).gitSha).toBe('unknown');
  });

  it('degrades to gitSha "unknown" when GIT_SHA is an empty string (Docker ARG-with-no-value case)', async () => {
    // A `docker build` without --build-arg GIT_SHA=... yields an empty string,
    // not undefined — `??` would let this through unchanged; `||` catches it.
    process.env.GIT_SHA = '';

    const res = await GET();

    expect((await res.json()).gitSha).toBe('unknown');
  });
});

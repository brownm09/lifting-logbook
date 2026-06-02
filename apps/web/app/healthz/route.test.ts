/**
 * @jest-environment node
 */
import * as route from './route';
import { GET } from './route';

describe('/healthz', () => {
  it('GET returns 200 with text body "ok"', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('ok');
  });

  it('does NOT export HEAD as a const alias (#409)', () => {
    // Regression guard: `export const HEAD = GET` passes Next.js 16.2.4
    // static analysis (the route appears in app-paths-manifest.json) but
    // breaks runtime route dispatch — both HEAD and GET requests to the
    // route return 404 at runtime. The smoke probe uses GET, so HEAD is
    // not required for the contract this route satisfies. If HEAD is ever
    // re-introduced, it must be a function declaration, not a const alias:
    //   export async function HEAD() { ... }
    // Originally added in #405, broke runtime routing across #406's merge
    // (commit 9937da1), root-caused in #409.
    expect((route as Record<string, unknown>).HEAD).toBeUndefined();
  });
});

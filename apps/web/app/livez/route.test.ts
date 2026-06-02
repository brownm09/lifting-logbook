/**
 * @jest-environment node
 */
import * as route from './route';
import { GET } from './route';

describe('/livez', () => {
  it('GET returns 200 with text body "ok"', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('ok');
  });

  it('does NOT export HEAD as a const alias (#409)', () => {
    // Conservative guard. The original /healthz bug turned out to be GFE
    // intercepting the /healthz path (the route was correct all along), so
    // the const-alias-HEAD hypothesis was disproven before reaching a true
    // empirical test. We keep this guard anyway: until Next.js 16.2.4's
    // behavior under const-alias HEAD is independently verified, prefer the
    // function form `export async function HEAD() { ... }` if HEAD ever
    // needs to be re-introduced.
    expect((route as Record<string, unknown>).HEAD).toBeUndefined();
  });
});

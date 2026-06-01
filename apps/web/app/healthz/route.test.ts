/**
 * @jest-environment node
 */
import { GET, HEAD } from './route';

describe('/healthz', () => {
  it('GET returns 200 with text body "ok"', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('ok');
  });

  it('HEAD is exported and shares the GET handler (#405)', () => {
    // GCP uptime checks and many uptime monitors default to HEAD.
    // Aliasing HEAD = GET is intentional — see route.ts comment.
    expect(HEAD).toBe(GET);
  });
});

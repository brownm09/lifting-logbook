/**
 * @jest-environment node
 */
import { GET } from './route';

describe('GET /healthz', () => {
  it('returns 200 with text body "ok"', async () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('ok');
  });
});

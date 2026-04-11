import request from 'supertest';
import { app } from '../src/server';

describe('GET /health', () => {
  it('returns status ok with an ISO timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});

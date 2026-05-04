import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../app.module';
import { SEED_PROGRAM } from '../adapters/in-memory/fixtures';
import { DomainNotFoundFilter } from './not-found.filter';

describe('Programs HTTP (e2e, in-memory adapters)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    app.useGlobalFilters(new DomainNotFoundFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const AUTH = { authorization: 'Bearer dev-token' };

  const get = (url: string) =>
    app.getHttpAdapter().getInstance().inject({ method: 'GET', url, headers: AUTH });

  const post = (url: string) =>
    app.getHttpAdapter().getInstance().inject({ method: 'POST', url, headers: AUTH });

  const postJson = (url: string, body: unknown) =>
    app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json', ...AUTH },
      payload: JSON.stringify(body),
    });

  const _patchJson = (url: string, body: unknown) =>
    app.getHttpAdapter().getInstance().inject({
      method: 'PATCH',
      url,
      headers: { 'content-type': 'application/json', ...AUTH },
      payload: JSON.stringify(body),
    });

  it('GET /health returns ok without auth', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /programs/:program/cycles/current returns 401 without auth', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: `/programs/${SEED_PROGRAM}/cycles/current` });
    expect(res.statusCode).toBe(401);
  });

  it('GET /programs/:program/cycles/current returns the seeded cycle', async () => {
    const res = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.program).toBe(SEED_PROGRAM);
    expect(body.cycleNum).toBe(1);
    expect(body.cycleStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('GET /programs/:program/workouts/:workoutNum returns grouped lifts', async () => {
    const res = await get(`/programs/${SEED_PROGRAM}/workouts/1`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.workoutNum).toBe(1);
    expect(body.lifts.length).toBeGreaterThan(0);
  });

  it('GET /programs/:program/training-maxes returns the seeded maxes', async () => {
    const res = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it('GET /programs/:program/lift-records returns records for current cycle', async () => {
    const res = await get(`/programs/${SEED_PROGRAM}/lift-records`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((r: { cycleNum: number }) => r.cycleNum === 1)).toBe(true);
  });

  it('GET /programs/:program/spec returns the seeded program spec', async () => {
    const res = await get(`/programs/${SEED_PROGRAM}/spec`);
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it('GET unknown program returns 404', async () => {
    const res = await get('/programs/does-not-exist/cycles/current');
    expect(res.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Write endpoints — order-sensitive; each test mutates singleton adapter
  // state and the next test observes that state. Do not reorder or randomize.
  // -------------------------------------------------------------------------

  describe('write operations', () => {
    it('POST /programs/:program/training-maxes/recalculate updates maxes from lift records', async () => {
      // Capture seeded Squat max before recalculate (cycle 1 has Squat records)
      const beforeRes = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
      const squatBefore = beforeRes
        .json()
        .find((m: { lift: string }) => m.lift === 'Squat').weight;

      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      for (const m of body) {
        expect(m).toMatchObject({
          lift: expect.any(String),
          weight: expect.any(Number),
          unit: 'lbs',
          dateUpdated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
      }
      // Squat has cycle-1 records — verify the max actually changed
      const squatAfter = body.find((m: { lift: string }) => m.lift === 'Squat').weight;
      expect(squatAfter).not.toBe(squatBefore);
    });

    it('POST /programs/:program/cycles advances cycleNum and persists new maxes', async () => {
      // Pre-condition: recalculate does not advance the cycle; counter is still 1
      expect((await get(`/programs/${SEED_PROGRAM}/cycles/current`)).json().cycleNum).toBe(1);

      const res = await post(`/programs/${SEED_PROGRAM}/cycles`);
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.program).toBe(SEED_PROGRAM);
      // Cycle counter must have advanced from the seeded value of 1
      expect(body.cycleNum).toBe(2);
      expect(body.cycleStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify the persisted dashboard is readable via GET
      const getRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().cycleNum).toBe(2);
    });

    it('POST /programs/:program/cycles with fromCycleNum uses that cycle\'s records', async () => {
      // Pre-condition: cycle is at 2 (advanced by previous test).
      // fromCycleNum=1 re-pins "advance from cycle 1", producing cycleNum=2 again — not normal
      // advancement, but confirms that fromCycleNum overrides the current counter.
      expect((await get(`/programs/${SEED_PROGRAM}/cycles/current`)).json().cycleNum).toBe(2);
      const res = await postJson(`/programs/${SEED_PROGRAM}/cycles`, { fromCycleNum: 1 });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.cycleNum).toBe(2);
      expect(body.cycleStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('POST /programs/:program/cycles with cycleDate pins the new cycle\'s start date', async () => {
      // Pre-condition: fromCycleNum re-pinned cycle to 2; advancing normally moves it to 3.
      expect((await get(`/programs/${SEED_PROGRAM}/cycles/current`)).json().cycleNum).toBe(2);
      const res = await postJson(`/programs/${SEED_PROGRAM}/cycles`, {
        cycleDate: '2026-06-01',
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().cycleStartDate).toBe('2026-06-01');
    });

    it('POST /programs/:program/cycles with fromCycleNum having no records returns 400', async () => {
      const res = await postJson(`/programs/${SEED_PROGRAM}/cycles`, { fromCycleNum: 99 });
      expect(res.statusCode).toBe(400);
    });

    it('POST /programs/unknown/cycles returns 404', async () => {
      const res = await post('/programs/does-not-exist/cycles');
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-workout progression scenario — order-sensitive, continues from the
  // state left by 'write operations' above: cycleNum=3, dev-token user.
  //
  // Seeded maxes after write operations (deterministic trace):
  //   Squat:          210 lbs  (record weight 205 + increment 5; dateUpdated 2026-04-20)
  //   Bench Press:    225 lbs  (no cycle-1 Bench records; unchanged from seed)
  //   Deadlift:       405 lbs  (no cycle-1 DL records; unchanged from seed)
  //   Overhead Press: 145 lbs  (no cycle-1 OHP records; unchanged from seed)
  //
  // Cycle 3 records logged below use dates newer than every dateUpdated above,
  // so the progression gate (record.date > max.dateUpdated) passes for hits.
  // -------------------------------------------------------------------------

  describe('multi-workout progression scenario', () => {
    it('logs bodyweight at session start', async () => {
      const res = await postJson(`/programs/${SEED_PROGRAM}/body-weight`, {
        date: '2026-07-01',
        weight: 190,
        unit: 'lbs',
      });
      expect(res.statusCode).toBe(201);
    });

    it('logs workout 1 — Squat hits target, Bench Press misses', async () => {
      // Squat set 1: reps=5 >= spec.reps=5 → progression gate passes
      const squatRes = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 3,
        workoutNum: 1,
        date: '2026-07-01',
        lift: 'Squat',
        setNum: 1,
        weight: 200,
        reps: 5,
        notes: '',
      });
      expect(squatRes.statusCode).toBe(201);

      // Bench Press set 1: reps=3 < spec.reps=5 → progression gate fails
      const benchRes = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 3,
        workoutNum: 1,
        date: '2026-07-01',
        lift: 'Bench Press',
        setNum: 1,
        weight: 160,
        reps: 3,
        notes: '',
      });
      expect(benchRes.statusCode).toBe(201);
    });

    it('logs workout 2 — Deadlift hits target, Overhead Press misses', async () => {
      // Deadlift set 1: reps=5 >= spec.reps=5 → progression gate passes
      const dlRes = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 3,
        workoutNum: 2,
        date: '2026-07-08',
        lift: 'Deadlift',
        setNum: 1,
        weight: 300,
        reps: 5,
        notes: '',
      });
      expect(dlRes.statusCode).toBe(201);

      // Overhead Press set 1: reps=2 < spec.reps=5 → progression gate fails
      const ohpRes = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 3,
        workoutNum: 2,
        date: '2026-07-08',
        lift: 'Overhead Press',
        setNum: 1,
        weight: 100,
        reps: 2,
        notes: '',
      });
      expect(ohpRes.statusCode).toBe(201);
    });

    it('GET /workouts/1 reflects completion status after workout 1 is logged', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/workouts/1`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cycleNum).toBe(3);
      expect(body.workoutNum).toBe(1);
      const liftNames = body.lifts.map((l: { lift: string }) => l.lift);
      expect(liftNames).toContain('Squat');
      expect(liftNames).toContain('Bench Press');
    });

    it('GET /workouts/2 reflects completion status after workout 2 is logged', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/workouts/2`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cycleNum).toBe(3);
      expect(body.workoutNum).toBe(2);
      const liftNames = body.lifts.map((l: { lift: string }) => l.lift);
      expect(liftNames).toContain('Deadlift');
      expect(liftNames).toContain('Overhead Press');
    });

    it('POST /training-maxes/recalculate updates only lifts that hit their targets', async () => {
      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const maxes = res.json() as Array<{ lift: string; weight: number }>;
      const find = (lift: string) => maxes.find((m) => m.lift === lift)!;

      // Squat hit target (200 lbs × 5 reps): new max = 200 + increment(5) = 205
      expect(find('Squat').weight).toBe(205);
      // Bench Press missed (3 reps < 5): max unchanged
      expect(find('Bench Press').weight).toBe(225);
      // Deadlift hit target (300 lbs × 5 reps): new max = 300 + increment(10) = 310
      expect(find('Deadlift').weight).toBe(310);
      // Overhead Press missed (2 reps < 5): max unchanged
      expect(find('Overhead Press').weight).toBe(145);
    });
  });

  it('isolates adapter state between users', async () => {
    const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
      app.getHttpAdapter().getInstance(),
    );

    const AS_ALICE = { authorization: 'Bearer user-alice' };
    const AS_BOB   = { authorization: 'Bearer user-bob'  };

    // Alice writes a distinctive training max — her bundle starts empty, this creates it.
    const patchRes = await injectRaw({
      method: 'PATCH',
      url: `/programs/${SEED_PROGRAM}/training-maxes`,
      headers: { 'content-type': 'application/json', ...AS_ALICE },
      payload: JSON.stringify({ maxes: [{ lift: 'Squat', weight: 999 }] }),
    });
    expect(patchRes.statusCode).toBe(200);

    // Alice sees her value.
    const aliceRes = await injectRaw({
      method: 'GET',
      url: `/programs/${SEED_PROGRAM}/training-maxes`,
      headers: AS_ALICE,
    });
    expect(aliceRes.json().find((m: { lift: string }) => m.lift === 'Squat')?.weight).toBe(999);

    // Bob reads the same program — his bundle is independent; Alice's write must not appear.
    const bobRes = await injectRaw({
      method: 'GET',
      url: `/programs/${SEED_PROGRAM}/training-maxes`,
      headers: AS_BOB,
    });
    expect(bobRes.statusCode).toBe(200);
    const bobSquat = bobRes.json().find((m: { lift: string }) => m.lift === 'Squat');
    expect(bobSquat).toBeUndefined();
  });
});

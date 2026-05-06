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

  const putJson = (url: string, body: unknown) =>
    app.getHttpAdapter().getInstance().inject({
      method: 'PUT',
      url,
      headers: { 'content-type': 'application/json', ...AUTH },
      payload: JSON.stringify(body),
    });

  const deleteReq = (url: string) =>
    app.getHttpAdapter().getInstance().inject({ method: 'DELETE', url, headers: AUTH });

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

  // ---------------------------------------------------------------------------
  // Workout reschedule (read-compatible: uses seeded cycle 1 data)
  // Run before write operations so cycleNum is still 1.
  // ---------------------------------------------------------------------------

  describe('workout reschedule', () => {
    const RESCHEDULE_URL = `/programs/${SEED_PROGRAM}/cycles/1/workouts/1/reschedule`;

    it('PATCH reschedule returns 204 No Content', async () => {
      const res = await _patchJson(RESCHEDULE_URL, { newDate: '2026-06-01' });
      expect(res.statusCode).toBe(204);
    });

    it('GET workout after reschedule includes overrideDate', async () => {
      await _patchJson(RESCHEDULE_URL, { newDate: '2026-06-01' });
      const res = await get(`/programs/${SEED_PROGRAM}/workouts/1`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.overrideDate).toBe('2026-06-01');
    });

    it('PATCH reschedule with invalid date returns 400', async () => {
      const res = await _patchJson(RESCHEDULE_URL, { newDate: 'not-a-date' });
      expect(res.statusCode).toBe(400);
    });

    it('PATCH reschedule with invalid workoutNum returns 400', async () => {
      const res = await _patchJson(
        `/programs/${SEED_PROGRAM}/cycles/1/workouts/0/reschedule`,
        { newDate: '2026-06-01' },
      );
      expect(res.statusCode).toBe(400);
    });

    it('PATCH reschedule requires auth', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const res = await injectRaw({ method: 'PATCH', url: RESCHEDULE_URL });
      expect(res.statusCode).toBe(401);
    });

    it('PATCH reschedule with unknown program returns 404', async () => {
      const res = await _patchJson(
        `/programs/no-such-program/cycles/1/workouts/1/reschedule`,
        { newDate: '2026-06-01' },
      );
      expect(res.statusCode).toBe(404);
    });

    it('PATCH reschedule with datetime string returns 400', async () => {
      const res = await _patchJson(RESCHEDULE_URL, { newDate: '2026-06-01T12:00:00Z' });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Write endpoints — order-sensitive; each test mutates singleton adapter
  // state and the next test observes that state. Do not reorder or randomize.
  // -------------------------------------------------------------------------

  describe('write operations', () => {
    it('POST /programs/:program/training-maxes/recalculate flags reductions and returns { maxes, flagged }', async () => {
      // Capture seeded Squat max before recalculate (cycle 1 has Squat records)
      const beforeRes = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
      const squatBefore = beforeRes
        .json()
        .find((m: { lift: string }) => m.lift === 'Squat').weight;

      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.maxes)).toBe(true);
      expect(body.maxes.length).toBeGreaterThan(0);
      expect(Array.isArray(body.flagged)).toBe(true);
      for (const m of body.maxes) {
        expect(m).toMatchObject({
          lift: expect.any(String),
          weight: expect.any(Number),
          unit: 'lbs',
          dateUpdated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
      }
      // Cycle-1 Squat set 1 was logged at 205 lbs → proposed max 210 < seeded TM 315.
      // Reduction must be flagged, not auto-applied; TM is unchanged.
      const squatFlag = body.flagged.find((f: { lift: string }) => f.lift === 'Squat');
      expect(squatFlag).toBeDefined();
      expect(squatFlag.currentWeight).toBe(squatBefore);
      expect(squatFlag.proposedWeight).toBe(210); // 205 + increment 5
      const squatAfter = body.maxes.find((m: { lift: string }) => m.lift === 'Squat').weight;
      expect(squatAfter).toBe(squatBefore); // max unchanged
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
  // TMs after write operations (deterministic trace):
  //   Squat:          315 lbs  (cycle-1 set-1 was 205 lbs → proposed 210 < 315 → flagged, not applied)
  //   Bench Press:    225 lbs  (no cycle-1 Bench records; unchanged from seed)
  //   Deadlift:       405 lbs  (no cycle-1 DL records; unchanged from seed)
  //   Overhead Press: 145 lbs  (no cycle-1 OHP records; unchanged from seed)
  //
  // Cycle 3 records logged below use dates newer than the seed dateUpdated (2026-04-13),
  // so the progression gate (record.date > max.dateUpdated) passes for hits.
  // Both Squat (200+5=205 < 315) and Deadlift (300+10=310 < 405) would be reductions
  // → both flagged, not applied.
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

    it('POST /training-maxes/recalculate flags reductions; only genuine increases are applied', async () => {
      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const body = res.json() as { maxes: Array<{ lift: string; weight: number }>; flagged: Array<{ lift: string; proposedWeight: number }> };
      const findMax = (lift: string) => body.maxes.find((m) => m.lift === lift)!;
      const findFlag = (lift: string) => body.flagged.find((f) => f.lift === lift);

      // Squat hit target (200 × 5) but 200+5=205 < current TM 315 → flagged, max unchanged
      expect(findMax('Squat').weight).toBe(315);
      expect(findFlag('Squat')).toBeDefined();
      expect(findFlag('Squat')!.proposedWeight).toBe(205);

      // Bench Press missed (3 reps < 5): no update, not flagged
      expect(findMax('Bench Press').weight).toBe(225);
      expect(findFlag('Bench Press')).toBeUndefined();

      // Deadlift hit target (300 × 5) but 300+10=310 < current TM 405 → flagged, max unchanged
      expect(findMax('Deadlift').weight).toBe(405);
      expect(findFlag('Deadlift')).toBeDefined();
      expect(findFlag('Deadlift')!.proposedWeight).toBe(310);

      // Overhead Press missed (2 reps < 5): no update, not flagged
      expect(findMax('Overhead Press').weight).toBe(145);
      expect(findFlag('Overhead Press')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Multi-cycle progression scenario — issue #142.
  //
  // Order-sensitive, continues from the state left by the multi-workout
  // scenario above:
  //   cycleNum:   3
  //   TMs:        Squat 315, Bench 225, Deadlift 405, Overhead Press 145
  //               (all dateUpdated 2026-04-13 — none updated by prior recalc)
  //   records:    cycle-3 set-1 entries for all 4 lifts (none updated TMs)
  //
  // Goal: drive at least one lift through a genuine TM increase across two
  // cycle-advance boundaries and assert the updated maxes persist into the
  // next cycle (the carry-forward chain that makes new-cycle planned
  // weights derive from prior-cycle outcomes).
  //
  // Logged set-1 weights are engineered at-or-near current TMs (not realistic
  // 5/3/1 loading) so the progression branch fires deterministically:
  //   record.reps >= spec.reps AND record.weight + spec.increment > current TM.
  // -------------------------------------------------------------------------

  describe('multi-cycle progression scenario (issue #142)', () => {
    // Tests in this block are order-dependent — do not reorder. Each `it`
    // mutates adapter state (cycleNum, training maxes, dateUpdated) that the
    // next one reads. Reordering will silently break expected-weight assertions
    // because the TM/dateUpdated gates in updateMaxes depend on prior state.
    it('advances cycle 3 → 4 to clear prior-scenario state; TMs unchanged', async () => {
      // Existing cycle-3 records were all flagged → updateMaxes leaves TMs at
      // 315/225/405/145. Advancing now just bumps cycleNum.
      const advanceRes = await post(`/programs/${SEED_PROGRAM}/cycles`);
      expect(advanceRes.statusCode).toBe(201);
      expect(advanceRes.json().cycleNum).toBe(4);

      const tmRes = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
      expect(tmRes.statusCode).toBe(200);
      const findTm = (lift: string) =>
        tmRes.json().find((m: { lift: string }) => m.lift === lift)!;
      expect(findTm('Squat').weight).toBe(315);
      expect(findTm('Bench Press').weight).toBe(225);
      expect(findTm('Deadlift').weight).toBe(405);
      expect(findTm('Overhead Press').weight).toBe(145);
    });

    it('cycle 4: logs records that drive Squat + Bench progression, leaves DL + OHP unchanged', async () => {
      // Date 2026-08-03 > all current TMs' dateUpdated (2026-04-13) → gate passes on date.
      // Squat: 315 + 5 = 320 > current TM 315 → applies (TM → 320).
      const squat = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 4, workoutNum: 1, date: '2026-08-03',
        lift: 'Squat', setNum: 1, weight: 315, reps: 5, notes: '',
      });
      expect(squat.statusCode).toBe(201);

      // Bench: 225 + 5 = 230 > current TM 225 → applies (TM → 230).
      const bench = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 4, workoutNum: 1, date: '2026-08-03',
        lift: 'Bench Press', setNum: 1, weight: 225, reps: 5, notes: '',
      });
      expect(bench.statusCode).toBe(201);

      // Deadlift: reps 3 < spec.reps 5 → gate fails (TM unchanged at 405).
      const dl = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 4, workoutNum: 1, date: '2026-08-03',
        lift: 'Deadlift', setNum: 1, weight: 300, reps: 3, notes: '',
      });
      expect(dl.statusCode).toBe(201);

      // OHP: reps 2 < spec.reps 5 → gate fails (TM unchanged at 145).
      const ohp = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 4, workoutNum: 1, date: '2026-08-03',
        lift: 'Overhead Press', setNum: 1, weight: 100, reps: 2, notes: '',
      });
      expect(ohp.statusCode).toBe(201);
    });

    it('cycle 4 → 5: recalculate applies Squat + Bench increases with no flags', async () => {
      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        maxes: Array<{ lift: string; weight: number }>;
        flagged: Array<{ lift: string }>;
      };
      const findMax = (lift: string) => body.maxes.find((m) => m.lift === lift)!;

      expect(findMax('Squat').weight).toBe(320);          // 315 + 5
      expect(findMax('Bench Press').weight).toBe(230);    // 225 + 5
      expect(findMax('Deadlift').weight).toBe(405);       // unchanged
      expect(findMax('Overhead Press').weight).toBe(145); // unchanged
      expect(body.flagged).toEqual([]);
    });

    it('cycle 4 → 5: POST /cycles persists updated maxes into cycle 5 (carry-forward)', async () => {
      const advanceRes = await post(`/programs/${SEED_PROGRAM}/cycles`);
      expect(advanceRes.statusCode).toBe(201);
      expect(advanceRes.json().cycleNum).toBe(5);

      // Carry-forward assertion: the maxes that downstream cycle-5 planned
      // weights will be computed from must reflect cycle-4 outcomes.
      const tmRes = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
      expect(tmRes.statusCode).toBe(200);
      const findTm = (lift: string) =>
        tmRes.json().find((m: { lift: string }) => m.lift === lift)!;
      expect(findTm('Squat').weight).toBe(320);
      expect(findTm('Bench Press').weight).toBe(230);
      expect(findTm('Deadlift').weight).toBe(405);
      expect(findTm('Overhead Press').weight).toBe(145);
    });

    it('cycle 5: logs records with different per-lift outcomes than cycle 4', async () => {
      // Date 2026-09-07 > all current TMs' dateUpdated (Squat/Bench: 2026-08-03;
      // DL/OHP: 2026-04-13) → gate passes on date for every lift.

      // Squat: reps 3 < 5 → gate fails (TM unchanged at 320).
      const squat = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 5, workoutNum: 1, date: '2026-09-07',
        lift: 'Squat', setNum: 1, weight: 322, reps: 3, notes: '',
      });
      expect(squat.statusCode).toBe(201);

      // Bench: 232 + 5 = 237 > current TM 230 → applies (TM → 237).
      const bench = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 5, workoutNum: 1, date: '2026-09-07',
        lift: 'Bench Press', setNum: 1, weight: 232, reps: 5, notes: '',
      });
      expect(bench.statusCode).toBe(201);

      // Deadlift: 410 + 10 = 420 > current TM 405 → applies (TM → 420).
      const dl = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 5, workoutNum: 1, date: '2026-09-07',
        lift: 'Deadlift', setNum: 1, weight: 410, reps: 5, notes: '',
      });
      expect(dl.statusCode).toBe(201);

      // OHP: 145 + 5 = 150 > current TM 145 → applies (TM → 150).
      const ohp = await postJson(`/programs/${SEED_PROGRAM}/lift-records`, {
        cycleNum: 5, workoutNum: 1, date: '2026-09-07',
        lift: 'Overhead Press', setNum: 1, weight: 145, reps: 5, notes: '',
      });
      expect(ohp.statusCode).toBe(201);
    });

    it('cycle 5 → 6: recalculate composes correctly across the second boundary', async () => {
      const res = await post(`/programs/${SEED_PROGRAM}/training-maxes/recalculate`);
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        maxes: Array<{ lift: string; weight: number }>;
        flagged: Array<{ lift: string }>;
      };
      const findMax = (lift: string) => body.maxes.find((m) => m.lift === lift)!;

      expect(findMax('Squat').weight).toBe(320);          // unchanged (reps<5)
      expect(findMax('Bench Press').weight).toBe(237);    // 232 + 5
      expect(findMax('Deadlift').weight).toBe(420);       // 410 + 10
      expect(findMax('Overhead Press').weight).toBe(150); // 145 + 5
      expect(body.flagged).toEqual([]);
    });

    it('cycle 5 → 6: POST /cycles persists final composed maxes into cycle 6', async () => {
      const advanceRes = await post(`/programs/${SEED_PROGRAM}/cycles`);
      expect(advanceRes.statusCode).toBe(201);
      expect(advanceRes.json().cycleNum).toBe(6);

      const tmRes = await get(`/programs/${SEED_PROGRAM}/training-maxes`);
      expect(tmRes.statusCode).toBe(200);
      const findTm = (lift: string) =>
        tmRes.json().find((m: { lift: string }) => m.lift === lift)!;
      expect(findTm('Squat').weight).toBe(320);
      expect(findTm('Bench Press').weight).toBe(237);
      expect(findTm('Deadlift').weight).toBe(420);
      expect(findTm('Overhead Press').weight).toBe(150);
    });
  });

  // -------------------------------------------------------------------------
  // Training max history — order-sensitive, continues from multi-cycle scenario.
  // At this point cycle advances and recalculates have written history entries.
  // -------------------------------------------------------------------------

  describe('training max history', () => {
    it('GET /training-maxes/history returns entries after cycle advances', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/training-maxes/history`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body.entries.length).toBeGreaterThan(0);
      for (const e of body.entries) {
        expect(e).toMatchObject({
          id: expect.any(String),
          lift: expect.any(String),
          weight: expect.any(Number),
          unit: 'lbs',
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          isPR: expect.any(Boolean),
          source: expect.stringMatching(/^(test|program)$/),
          goalMet: expect.any(Boolean),
        });
      }
    });

    it('GET /training-maxes/history?lift=Bench+Press filters to that lift', async () => {
      const res = await get(
        `/programs/${SEED_PROGRAM}/training-maxes/history?lift=${encodeURIComponent('Bench Press')}`,
      );
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries.every((e: { lift: string }) => e.lift === 'Bench Press')).toBe(true);
    });

    it('GET /training-maxes/history?isPR=true returns empty before any entry is marked', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/training-maxes/history?isPR=true`);
      expect(res.statusCode).toBe(200);
      expect(res.json().entries).toEqual([]);
    });

    it('PATCH /training-maxes/history/:id marks an entry as PR', async () => {
      const listRes = await get(`/programs/${SEED_PROGRAM}/training-maxes/history`);
      const firstId = listRes.json().entries[0].id as string;

      const patchRes = await app.getHttpAdapter().getInstance().inject({
        method: 'PATCH',
        url: `/programs/${SEED_PROGRAM}/training-maxes/history/${firstId}`,
        headers: { 'content-type': 'application/json', authorization: 'Bearer dev-token' },
        payload: JSON.stringify({ isPR: true }),
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json()).toMatchObject({ id: firstId, isPR: true });

      // Verify persistence: GET ?isPR=true now includes the entry
      const prRes = await get(`/programs/${SEED_PROGRAM}/training-maxes/history?isPR=true`);
      expect(prRes.json().entries.some((e: { id: string }) => e.id === firstId)).toBe(true);
    });

    it('PATCH /training-maxes/history/:id with unknown id returns 404', async () => {
      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'PATCH',
        url: `/programs/${SEED_PROGRAM}/training-maxes/history/nonexistent-id`,
        headers: { 'content-type': 'application/json', authorization: 'Bearer dev-token' },
        payload: JSON.stringify({ isPR: true }),
      });
      expect(res.statusCode).toBe(404);
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

  describe('strength-goals write operations', () => {
    const GOAL_URL = `/programs/${SEED_PROGRAM}/strength-goals`;

    it('PUT → GET → DELETE lifecycle (relative goal)', async () => {
      // PUT creates a relative goal
      const putRes = await putJson(`${GOAL_URL}/Squat`, { goalType: 'relative', ratio: 1.75, unit: 'lbs' });
      expect(putRes.statusCode).toBe(200);
      const created = putRes.json();
      expect(created.lift).toBe('Squat');
      expect(created.goalType).toBe('relative');
      expect(created.ratio).toBe(1.75);
      expect(created.unit).toBe('lbs');

      // GET returns the goal
      const getRes = await get(GOAL_URL);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ lift: 'Squat', goalType: 'relative', ratio: 1.75 }),
      ]));

      // DELETE removes the goal
      const delRes = await deleteReq(`${GOAL_URL}/Squat`);
      expect(delRes.statusCode).toBe(204);

      // GET after DELETE returns empty
      const getAfterDel = await get(GOAL_URL);
      const remaining = getAfterDel.json() as { lift: string }[];
      expect(remaining.find((g) => g.lift === 'Squat')).toBeUndefined();
    });

    it('PUT absolute goal stores target', async () => {
      const putRes = await putJson(`${GOAL_URL}/Bench Press`, { goalType: 'absolute', target: 225, unit: 'lbs' });
      expect(putRes.statusCode).toBe(200);
      const created = putRes.json();
      expect(created.goalType).toBe('absolute');
      expect(created.target).toBe(225);
    });

    it('PUT same lift twice — only latest persists (idempotency)', async () => {
      await putJson(`${GOAL_URL}/Deadlift`, { goalType: 'absolute', target: 400, unit: 'lbs' });
      const secondPut = await putJson(`${GOAL_URL}/Deadlift`, { goalType: 'absolute', target: 450, unit: 'lbs' });
      expect(secondPut.statusCode).toBe(200);
      expect(secondPut.json().target).toBe(450);

      const getRes = await get(GOAL_URL);
      const goals = getRes.json() as { lift: string; target: number }[];
      const deadlifts = goals.filter((g) => g.lift === 'Deadlift');
      expect(deadlifts).toHaveLength(1);
      expect(deadlifts[0].target).toBe(450);
    });

    it('DELETE unknown lift returns 404', async () => {
      const res = await deleteReq(`${GOAL_URL}/UnknownLift`);
      expect(res.statusCode).toBe(404);
    });

    it('isolates strength goals between users', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );

      const AS_ALICE = { authorization: 'Bearer user-alice-goals' };
      const AS_BOB   = { authorization: 'Bearer user-bob-goals' };

      // Alice writes a strength goal
      const alicePut = await injectRaw({
        method: 'PUT',
        url: `${GOAL_URL}/Bench Press`,
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ goalType: 'absolute', target: 200, unit: 'lbs' }),
      });
      expect(alicePut.statusCode).toBe(200);

      // Bob reads — must not see Alice's goal
      const bobGet = await injectRaw({
        method: 'GET',
        url: GOAL_URL,
        headers: AS_BOB,
      });
      expect(bobGet.statusCode).toBe(200);
      const bobGoals = bobGet.json() as { lift: string }[];
      expect(bobGoals.find((g) => g.lift === 'Bench Press')).toBeUndefined();
    });
  });

  describe('manage lifts overrides', () => {
    const PROGRAM = SEED_PROGRAM;
    // Cycle 1, workout 1 is used for override tests. The seed data has records
    // for the dev user so override operations run against a known baseline.
    const OVERRIDE_URL = (cycleNum: number, workoutNum: number) =>
      `/programs/${PROGRAM}/cycles/${cycleNum}/workouts/${workoutNum}/lift-overrides`;

    it('GET /programs/:program/lifts returns the lift catalog', async () => {
      const res = await get(`/programs/${PROGRAM}/lifts`);
      expect(res.statusCode).toBe(200);
      const lifts = res.json() as string[];
      expect(Array.isArray(lifts)).toBe(true);
      expect(lifts).toContain('Squat');
      expect(lifts.length).toBeGreaterThan(0);
    });

    it('POST add override returns 201 with the override', async () => {
      const res = await postJson(OVERRIDE_URL(1, 1), { action: 'add', lift: 'Chin-up' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ action: 'add', lift: 'Chin-up' });
    });

    it('POST remove override and GET workout — lift absent from response', async () => {
      // First confirm Squat is present in workout 1
      const before = await get(`/programs/${PROGRAM}/workouts/1`);
      expect(before.statusCode).toBe(200);
      const liftsBefore = (before.json() as { lifts: { lift: string }[] }).lifts;
      expect(liftsBefore.some((l) => l.lift === 'Squat')).toBe(true);

      // Apply remove override using the current cycleNum from dashboard
      const dashRes = await get(`/programs/${PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };
      await postJson(OVERRIDE_URL(cycleNum, 1), { action: 'remove', lift: 'Squat' });

      // GET workout — Squat should now be absent
      const after = await get(`/programs/${PROGRAM}/workouts/1`);
      expect(after.statusCode).toBe(200);
      const liftsAfter = (after.json() as { lifts: { lift: string }[] }).lifts;
      expect(liftsAfter.some((l) => l.lift === 'Squat')).toBe(false);

      // Cleanup: delete the override
      const dashRes2 = await get(`/programs/${PROGRAM}/cycles/current`);
      const { cycleNum: cn } = dashRes2.json() as { cycleNum: number };
      await deleteReq(`${OVERRIDE_URL(cn, 1)}/Squat`);
    });

    it('POST replace override — old lift absent, new lift present', async () => {
      const dashRes = await get(`/programs/${PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };
      await postJson(OVERRIDE_URL(cycleNum, 1), { action: 'replace', lift: 'Squat', replacedBy: 'Front Squat' });

      const res = await get(`/programs/${PROGRAM}/workouts/1`);
      const lifts = (res.json() as { lifts: { lift: string }[] }).lifts;
      expect(lifts.some((l) => l.lift === 'Squat')).toBe(false);
      expect(lifts.some((l) => l.lift === 'Front Squat')).toBe(true);

      // Cleanup
      await deleteReq(`${OVERRIDE_URL(cycleNum, 1)}/Squat`);
    });

    it('DELETE override is idempotent — returns 204 even when override absent', async () => {
      const dashRes = await get(`/programs/${PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };
      const res = await deleteReq(`${OVERRIDE_URL(cycleNum, 99)}/NonExistentLift`);
      expect(res.statusCode).toBe(204);
    });

    it('POST replace without replacedBy returns 400', async () => {
      const res = await postJson(OVERRIDE_URL(1, 1), { action: 'replace', lift: 'Squat' });
      expect(res.statusCode).toBe(400);
    });

    it('isolates lift overrides between users', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const AS_ALICE = { authorization: 'Bearer user-alice-lifts' };
      const AS_BOB   = { authorization: 'Bearer user-bob-lifts' };

      // Alice adds a Cable Curls override for cycle 1, workout 1.
      // Use cycleNum=1 directly (Alice is a fresh user with no cycle dashboard).
      await injectRaw({
        method: 'POST',
        url: OVERRIDE_URL(1, 1),
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ action: 'add', lift: 'Cable Curls' }),
      });

      // Bob GETs workout 1 — should NOT see Cable Curls (Alice's override is isolated).
      const bobWorkout = await injectRaw({ method: 'GET', url: `/programs/${PROGRAM}/workouts/1`, headers: AS_BOB });
      expect(bobWorkout.statusCode).toBe(200);
      const bobLifts = (bobWorkout.json() as { lifts: { lift: string }[] }).lifts;
      expect(bobLifts.some((l) => l.lift === 'Cable Curls')).toBe(false);
    });
  });
});

// Runs only when DATABASE_URL is set; skipped in the normal npm test / CI lint-and-test job.
// CI: the db-integration job injects DATABASE_URL via a postgres service container.
// Local: docker-compose.test.yml spins up Postgres on port 5433, then:
//   DATABASE_URL=postgresql://lifting:lifting@localhost:5433/lifting_test \
//   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && \
//   npm test -w @lifting-logbook/api -- --testPathPattern=db.e2e
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../app.module';
import {
  SEED_PROGRAM,
  seedCycleDashboard,
  seedLiftRecords,
  seedTrainingMaxes,
} from '../adapters/in-memory/fixtures';
import { DomainNotFoundFilter } from './not-found.filter';

const TEST_USER = 'db-e2e-primary';
const USER_ALICE = 'db-e2e-alice';
const USER_BOB = 'db-e2e-bob';

const USER_INIT = 'db-e2e-init';

async function cleanTestUsers(prisma: PrismaClient): Promise<void> {
  const users = [TEST_USER, USER_ALICE, USER_BOB, USER_INIT];
  await prisma.liftRecord.deleteMany({ where: { userId: { in: users } } });
  await prisma.trainingMax.deleteMany({ where: { userId: { in: users } } });
  await prisma.trainingMaxHistory.deleteMany({ where: { userId: { in: users } } });
  await prisma.cycleDashboard.deleteMany({ where: { userId: { in: users } } });
  await prisma.workoutLiftOverride.deleteMany({ where: { userId: { in: users } } });
  await prisma.workoutDateOverride.deleteMany({ where: { userId: { in: users } } });
  await prisma.strengthGoal.deleteMany({ where: { userId: { in: users } } });
  await prisma.liftMetadata.deleteMany({ where: { userId: { in: users } } });
}

const describeOrSkip = process.env.DATABASE_URL ? describe : describe.skip;

describeOrSkip('Programs HTTP (e2e, PrismaRepositoryFactory)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaClient;

  const AUTH = { authorization: `Bearer ${TEST_USER}` };

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

  const patchJson = (url: string, body: unknown) =>
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

  const postCsv = (url: string, csvContent: string) => {
    const boundary = '----LiftRecordImportBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="records.csv"',
      'Content-Type: text/csv',
      '',
      csvContent,
      `--${boundary}--`,
    ].join('\r\n');
    return app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, ...AUTH },
      payload: body,
    });
  };

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clean any leftover data from an interrupted previous run before seeding.
    await cleanTestUsers(prisma);

    const dashboard = seedCycleDashboard();
    await prisma.cycleDashboard.create({
      data: {
        userId: TEST_USER,
        program: SEED_PROGRAM,
        cycleUnit: dashboard.cycleUnit,
        cycleNum: dashboard.cycleNum,
        cycleDate: dashboard.cycleDate,
        sheetName: dashboard.sheetName,
        cycleStartWeekday: dashboard.cycleStartWeekday,
        currentWeekType: dashboard.currentWeekType,
        programType: dashboard.programType ?? null,
      },
    });

    await prisma.trainingMax.createMany({
      data: seedTrainingMaxes().map((m) => ({
        userId: TEST_USER,
        program: SEED_PROGRAM,
        lift: m.lift,
        weight: m.weight,
        dateUpdated: m.dateUpdated,
      })),
    });

    await prisma.liftRecord.createMany({
      data: seedLiftRecords().map((r) => ({
        userId: TEST_USER,
        program: r.program,
        cycleNum: r.cycleNum,
        workoutNum: r.workoutNum,
        date: r.date,
        lift: r.lift,
        setNum: r.setNum,
        weight: r.weight,
        reps: r.reps,
        notes: r.notes,
      })),
    });

    // DATABASE_URL is set in the environment, so RepositoryFactoryModule selects PrismaRepositoryFactory.
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(multipart as any, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
    app.useGlobalFilters(new DomainNotFoundFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    await cleanTestUsers(prisma);
    await prisma?.$disconnect();
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
  // Write endpoints — order-sensitive; each test mutates DB state for TEST_USER
  // and the next test observes that state. Do not reorder or randomize.
  // -------------------------------------------------------------------------

  describe('write operations', () => {
    it('PATCH /programs/:program/training-maxes updates maxes and returns the full set', async () => {
      const res = await patchJson(`/programs/${SEED_PROGRAM}/training-maxes`, {
        maxes: [{ lift: 'Squat', weight: 300 }],
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      const squat = body.find((m: { lift: string }) => m.lift === 'Squat');
      expect(squat).toMatchObject({
        lift: 'Squat',
        weight: 300,
        unit: 'lbs',
        dateUpdated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });

    it('POST /programs/:program/training-maxes/recalculate updates maxes from lift records', async () => {
      // Pre-condition: PATCH above set Squat to 300; recalculate will derive a new value from records.
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
      const squatAfter = body.find((m: { lift: string }) => m.lift === 'Squat').weight;
      expect(squatAfter).not.toBe(squatBefore);
    });

    it('POST /programs/:program/cycles advances cycleNum and persists new maxes', async () => {
      expect((await get(`/programs/${SEED_PROGRAM}/cycles/current`)).json().cycleNum).toBe(1);

      const res = await post(`/programs/${SEED_PROGRAM}/cycles`);
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.program).toBe(SEED_PROGRAM);
      expect(body.cycleNum).toBe(2);
      expect(body.cycleStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const getRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().cycleNum).toBe(2);
    });

    it('POST /programs/:program/cycles with fromCycleNum uses that cycle\'s records', async () => {
      expect((await get(`/programs/${SEED_PROGRAM}/cycles/current`)).json().cycleNum).toBe(2);
      const res = await postJson(`/programs/${SEED_PROGRAM}/cycles`, { fromCycleNum: 1 });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.cycleNum).toBe(2);
      expect(body.cycleStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify the re-pinned cycle is persisted to the DB (not just returned in the response).
      const getRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().cycleNum).toBe(2);
    });

    it('POST /programs/:program/cycles with cycleDate pins the new cycle\'s start date', async () => {
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
  // Training max history — order-sensitive, continues from write operations.
  // At this point cycle advances have written history rows for changed lifts.
  // -------------------------------------------------------------------------

  describe('training max history', () => {
    it('GET /training-maxes/history returns entries after cycle advances', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/training-maxes/history`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.entries)).toBe(true);
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

    it('GET /training-maxes/history?lift=Squat filters to that lift', async () => {
      const res = await get(`/programs/${SEED_PROGRAM}/training-maxes/history?lift=Squat`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries.every((e: { lift: string }) => e.lift === 'Squat')).toBe(true);
    });

    it('PATCH /training-maxes/history/:id marks entry as PR and persists to DB', async () => {
      const listRes = await get(`/programs/${SEED_PROGRAM}/training-maxes/history`);
      const entries = listRes.json().entries as Array<{ id: string }>;
      if (entries.length === 0) {
        // No maxes changed — skip toggle test gracefully
        return;
      }
      const firstId = entries[0].id;

      const patchRes = await patchJson(
        `/programs/${SEED_PROGRAM}/training-maxes/history/${firstId}`,
        { isPR: true },
      );
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json()).toMatchObject({ id: firstId, isPR: true });

      // DB-level assertion
      const row = await prisma.trainingMaxHistory.findFirst({
        where: { id: firstId, userId: TEST_USER },
      });
      expect(row?.isPR).toBe(true);
    });

    it('GET /training-maxes/history?isPR=true returns only PR-marked entries', async () => {
      // Depends on the PATCH test above having marked the first entry.
      const res = await get(`/programs/${SEED_PROGRAM}/training-maxes/history?isPR=true`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries.length).toBeGreaterThan(0);
      expect(body.entries.every((e: { isPR: boolean }) => e.isPR === true)).toBe(true);
    });

    it('PATCH /training-maxes/history/:id with unknown id returns 404', async () => {
      const res = await patchJson(
        `/programs/${SEED_PROGRAM}/training-maxes/history/nonexistent-id`,
        { isPR: true },
      );
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST cycles/initialize — uses USER_INIT who has no seed data.
  // Order-sensitive within the block (409 test depends on happy path row).
  // -------------------------------------------------------------------------

  describe('POST /programs/:program/cycles/initialize (DB)', () => {
    const AS_INIT = { authorization: `Bearer ${USER_INIT}` };

    it('happy path — creates a CycleDashboard row and returns 201 with expected shape', async () => {
      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/programs/5-3-1/cycles/initialize',
        headers: { 'content-type': 'application/json', ...AS_INIT },
        payload: JSON.stringify({ cycleDate: '2026-06-02' }),
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.program).toBe('5-3-1');
      expect(body.cycleNum).toBe(1);
      expect(body.cycleStartDate).toBe('2026-06-02');
      expect(body.currentWeekType).toBe('training');
      expect(body.weeks).toEqual([]);

      // DB-level assertion
      const row = await prisma.cycleDashboard.findFirst({
        where: { userId: USER_INIT, program: '5-3-1' },
      });
      expect(row).not.toBeNull();
      expect(row?.cycleNum).toBe(1);
    });

    it('409 Conflict — second call for the same user+program', async () => {
      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/programs/5-3-1/cycles/initialize',
        headers: { 'content-type': 'application/json', ...AS_INIT },
        payload: JSON.stringify({}),
      });
      expect(res.statusCode).toBe(409);
    });

    it('400 Bad Request — unrecognized program ID', async () => {
      const res = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/programs/not-a-real-program/cycles/initialize',
        headers: { 'content-type': 'application/json', ...AS_INIT },
        payload: JSON.stringify({}),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('isolates row-level data between users in Postgres', async () => {
    const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
      app.getHttpAdapter().getInstance(),
    );

    const AS_ALICE = { authorization: `Bearer ${USER_ALICE}` };
    const AS_BOB = { authorization: `Bearer ${USER_BOB}` };

    // Alice writes a distinctive training max — her rows start empty, this creates it.
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

    // Bob reads the same program — his rows are independent; Alice's write must not appear.
    const bobRes = await injectRaw({
      method: 'GET',
      url: `/programs/${SEED_PROGRAM}/training-maxes`,
      headers: AS_BOB,
    });
    expect(bobRes.statusCode).toBe(200);
    const bobSquat = bobRes.json().find((m: { lift: string }) => m.lift === 'Squat');
    expect(bobSquat).toBeUndefined();

    // Verify at the DB layer — Alice's row exists and Bob's does not.
    const aliceRow = await prisma.trainingMax.findFirst({
      where: { userId: USER_ALICE, program: SEED_PROGRAM, lift: 'Squat' },
    });
    expect(aliceRow?.weight).toBe(999);

    const bobRow = await prisma.trainingMax.findFirst({
      where: { userId: USER_BOB, program: SEED_PROGRAM, lift: 'Squat' },
    });
    expect(bobRow).toBeNull();
  });

  describe('workout lift overrides (DB)', () => {
    const deleteReq = (url: string) =>
      app.getHttpAdapter().getInstance().inject({ method: 'DELETE', url, headers: AUTH });

    it('POST override persists to the database', async () => {
      const dashRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };

      const res = await postJson(
        `/programs/${SEED_PROGRAM}/cycles/${cycleNum}/workouts/1/lift-overrides`,
        { action: 'add', lift: 'Dips' },
      );
      expect(res.statusCode).toBe(201);

      const row = await prisma.workoutLiftOverride.findFirst({
        where: { userId: TEST_USER, program: SEED_PROGRAM, cycleNum, workoutNum: 1, lift: 'Dips' },
      });
      expect(row).not.toBeNull();
      expect(row?.action).toBe('add');
    });

    it('DELETE override removes the row', async () => {
      const dashRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };

      // Create first
      await postJson(
        `/programs/${SEED_PROGRAM}/cycles/${cycleNum}/workouts/1/lift-overrides`,
        { action: 'remove', lift: 'Squat' },
      );

      // Then delete
      const delRes = await deleteReq(
        `/programs/${SEED_PROGRAM}/cycles/${cycleNum}/workouts/1/lift-overrides/Squat`,
      );
      expect(delRes.statusCode).toBe(204);

      const row = await prisma.workoutLiftOverride.findFirst({
        where: { userId: TEST_USER, program: SEED_PROGRAM, cycleNum, workoutNum: 1, lift: 'Squat' },
      });
      expect(row).toBeNull();
    });

    it('user isolation — lift overrides are scoped to userId', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const AS_ALICE = { authorization: `Bearer ${USER_ALICE}` };
      const AS_BOB = { authorization: `Bearer ${USER_BOB}` };

      const dashAlice = await injectRaw({ method: 'GET', url: `/programs/${SEED_PROGRAM}/cycles/current`, headers: AS_ALICE });
      const { cycleNum } = dashAlice.json() as { cycleNum: number };

      // Alice adds an override
      const alicePost = await injectRaw({
        method: 'POST',
        url: `/programs/${SEED_PROGRAM}/cycles/${cycleNum}/workouts/1/lift-overrides`,
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ action: 'add', lift: 'Face Pulls' }),
      });
      expect(alicePost.statusCode).toBe(201);

      // Bob GETs the workout — should NOT contain Face Pulls
      const bobWorkout = await injectRaw({ method: 'GET', url: `/programs/${SEED_PROGRAM}/workouts/1`, headers: AS_BOB });
      const bobLifts = (bobWorkout.json() as { lifts: { lift: string }[] }).lifts;
      expect(bobLifts.some((l) => l.lift === 'Face Pulls')).toBe(false);

      // DB layer — Alice's row exists, Bob's does not
      const aliceRow = await prisma.workoutLiftOverride.findFirst({
        where: { userId: USER_ALICE, program: SEED_PROGRAM, lift: 'Face Pulls' },
      });
      expect(aliceRow).not.toBeNull();

      const bobRow = await prisma.workoutLiftOverride.findFirst({
        where: { userId: USER_BOB, program: SEED_PROGRAM, lift: 'Face Pulls' },
      });
      expect(bobRow).toBeNull();
    });
  });

  describe('workout rescheduling (DB)', () => {
    it('PATCH reschedule persists override and GET workout returns overrideDate', async () => {
      const dashRes = await get(`/programs/${SEED_PROGRAM}/cycles/current`);
      const { cycleNum } = dashRes.json() as { cycleNum: number };

      const patchRes = await patchJson(
        `/programs/${SEED_PROGRAM}/cycles/${cycleNum}/workouts/1/reschedule`,
        { newDate: '2026-09-01' },
      );
      expect(patchRes.statusCode).toBe(204);

      const workoutRes = await get(`/programs/${SEED_PROGRAM}/workouts/1`);
      expect(workoutRes.statusCode).toBe(200);
      expect(workoutRes.json().overrideDate).toBe('2026-09-01');

      const row = await prisma.workoutDateOverride.findFirst({
        where: { userId: TEST_USER, program: SEED_PROGRAM, cycleNum, workoutNum: 1 },
      });
      expect(row).not.toBeNull();
    });

    it('user isolation — reschedule override is scoped to userId', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const AS_ALICE = { authorization: `Bearer ${USER_ALICE}` };
      const AS_BOB = { authorization: `Bearer ${USER_BOB}` };

      // Alice reschedules cycle 1, workout 2
      const alicePatch = await injectRaw({
        method: 'PATCH',
        url: `/programs/${SEED_PROGRAM}/cycles/1/workouts/2/reschedule`,
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ newDate: '2026-09-15' }),
      });
      expect(alicePatch.statusCode).toBe(204);

      // Bob GETs workout 2 — overrideDate must be absent
      const bobWorkout = await injectRaw({
        method: 'GET',
        url: `/programs/${SEED_PROGRAM}/workouts/2`,
        headers: AS_BOB,
      });
      expect(bobWorkout.statusCode).toBe(200);
      expect(bobWorkout.json().overrideDate).toBeUndefined();

      // DB layer — Alice's row exists, Bob's does not
      const aliceRow = await prisma.workoutDateOverride.findFirst({
        where: { userId: USER_ALICE, program: SEED_PROGRAM, cycleNum: 1, workoutNum: 2 },
      });
      expect(aliceRow).not.toBeNull();

      const bobRow = await prisma.workoutDateOverride.findFirst({
        where: { userId: USER_BOB, program: SEED_PROGRAM, cycleNum: 1, workoutNum: 2 },
      });
      expect(bobRow).toBeNull();
    });
  });

  describe('strength goals (DB)', () => {
    const GOAL_URL = `/programs/${SEED_PROGRAM}/strength-goals`;

    it('PUT → GET → DELETE lifecycle persists to and removes from the database', async () => {
      const putRes = await putJson(`${GOAL_URL}/Squat`, { goalType: 'absolute', target: 405, unit: 'lbs' });
      expect(putRes.statusCode).toBe(200);
      expect(putRes.json()).toMatchObject({ lift: 'Squat', goalType: 'absolute', target: 405 });

      const getRes = await get(GOAL_URL);
      expect(getRes.statusCode).toBe(200);
      const goals = getRes.json() as { lift: string; target: number }[];
      expect(goals.some((g) => g.lift === 'Squat' && g.target === 405)).toBe(true);

      const delRes = await deleteReq(`${GOAL_URL}/Squat`);
      expect(delRes.statusCode).toBe(204);

      const row = await prisma.strengthGoal.findFirst({
        where: { userId: TEST_USER, program: SEED_PROGRAM, lift: 'Squat' },
      });
      expect(row).toBeNull();
    });

    it('PUT same lift twice — upsert; only one DB row and latest target wins', async () => {
      await putJson(`${GOAL_URL}/Deadlift`, { goalType: 'absolute', target: 500, unit: 'lbs' });
      const secondPut = await putJson(`${GOAL_URL}/Deadlift`, { goalType: 'absolute', target: 550, unit: 'lbs' });
      expect(secondPut.statusCode).toBe(200);
      expect(secondPut.json().target).toBe(550);

      const rows = await prisma.strengthGoal.findMany({
        where: { userId: TEST_USER, program: SEED_PROGRAM, lift: 'Deadlift' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].target).toBe(550);
    });

    it('user isolation — strength goals are scoped to userId', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const AS_ALICE = { authorization: `Bearer ${USER_ALICE}` };
      const AS_BOB = { authorization: `Bearer ${USER_BOB}` };

      // Alice sets a goal
      const alicePut = await injectRaw({
        method: 'PUT',
        url: `${GOAL_URL}/Bench Press`,
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ goalType: 'absolute', target: 225, unit: 'lbs' }),
      });
      expect(alicePut.statusCode).toBe(200);

      // Bob lists goals — must not see Alice's Bench Press goal
      const bobGet = await injectRaw({ method: 'GET', url: GOAL_URL, headers: AS_BOB });
      expect(bobGet.statusCode).toBe(200);
      const bobGoals = bobGet.json() as { lift: string }[];
      expect(bobGoals.some((g) => g.lift === 'Bench Press')).toBe(false);

      // DB layer — Alice's row exists, Bob's does not
      const aliceRow = await prisma.strengthGoal.findFirst({
        where: { userId: USER_ALICE, program: SEED_PROGRAM, lift: 'Bench Press' },
      });
      expect(aliceRow).not.toBeNull();

      const bobRow = await prisma.strengthGoal.findFirst({
        where: { userId: USER_BOB, program: SEED_PROGRAM, lift: 'Bench Press' },
      });
      expect(bobRow).toBeNull();
    });
  });

  describe('lift metadata (DB)', () => {
    it('PATCH metadata persists and GET returns updated values', async () => {
      const patchRes = await patchJson('/lifts/Squat/metadata', {
        muscleGroups: ['Quads', 'Glutes'],
        substitutions: ['Leg Press'],
        foundational: true,
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json()).toMatchObject({
        muscleGroups: ['Quads', 'Glutes'],
        substitutions: ['Leg Press'],
        foundational: true,
      });

      const getRes = await get('/lifts/Squat/metadata');
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json()).toMatchObject({
        muscleGroups: ['Quads', 'Glutes'],
        substitutions: ['Leg Press'],
        foundational: true,
      });

      const row = await prisma.liftMetadata.findFirst({
        where: { userId: TEST_USER, lift: 'Squat' },
      });
      expect(row).not.toBeNull();
      expect(row?.foundational).toBe(true);
    });

    it('user isolation — lift metadata is scoped to userId', async () => {
      const injectRaw = app.getHttpAdapter().getInstance().inject.bind(
        app.getHttpAdapter().getInstance(),
      );
      const AS_ALICE = { authorization: `Bearer ${USER_ALICE}` };
      const AS_BOB = { authorization: `Bearer ${USER_BOB}` };

      // Alice sets metadata for Deadlift
      const alicePatch = await injectRaw({
        method: 'PATCH',
        url: '/lifts/Deadlift/metadata',
        headers: { 'content-type': 'application/json', ...AS_ALICE },
        payload: JSON.stringify({ muscleGroups: ['Hamstrings'], foundational: true }),
      });
      expect(alicePatch.statusCode).toBe(200);

      // Bob GETs Deadlift metadata — must see empty defaults
      const bobGet = await injectRaw({ method: 'GET', url: '/lifts/Deadlift/metadata', headers: AS_BOB });
      expect(bobGet.statusCode).toBe(200);
      const bobBody = bobGet.json() as { muscleGroups: string[]; foundational: boolean };
      expect(bobBody.muscleGroups).toEqual([]);
      expect(bobBody.foundational).toBe(false);

      // DB layer — Alice's row exists, Bob's does not
      const aliceRow = await prisma.liftMetadata.findFirst({
        where: { userId: USER_ALICE, lift: 'Deadlift' },
      });
      expect(aliceRow).not.toBeNull();

      const bobRow = await prisma.liftMetadata.findFirst({
        where: { userId: USER_BOB, lift: 'Deadlift' },
      });
      expect(bobRow).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // CSV import
  // ---------------------------------------------------------------------------

  describe('POST /programs/:program/lift-records/import', () => {
    const IMPORT_URL = `/programs/${SEED_PROGRAM}/lift-records/import`;

    // Resolve fixture path relative to the monorepo root (packages/core/tests/fixtures)
    const FIXTURE_PATH = path.resolve(
      __dirname,
      '../../../../packages/core/tests/fixtures/lift_records.csv',
    );

    beforeEach(async () => {
      // Start each import test with a clean slate for this user's lift records
      await prisma.liftRecord.deleteMany({ where: { userId: TEST_USER, program: SEED_PROGRAM } });
    });

    it('happy path — imports the full fixture CSV and returns a written count', async () => {
      const csvContent = fs.readFileSync(FIXTURE_PATH, 'utf8');

      const res = await postCsv(IMPORT_URL, csvContent);
      expect(res.statusCode).toBe(201);

      const body = res.json() as { written: number; skipped: { row: number; naturalKey: string }[] };
      expect(body.written).toBeGreaterThan(0);
      expect(Array.isArray(body.skipped)).toBe(true);

      // Verify rows actually landed in the DB
      const dbCount = await prisma.liftRecord.count({ where: { userId: TEST_USER, program: SEED_PROGRAM } });
      expect(dbCount).toBe(body.written);
    });

    it('re-import returns written=0 and skipped=all rows from first import', async () => {
      const csvContent = fs.readFileSync(FIXTURE_PATH, 'utf8');

      // First import
      const first = await postCsv(IMPORT_URL, csvContent);
      expect(first.statusCode).toBe(201);
      const firstBody = first.json() as { written: number; skipped: { row: number; naturalKey: string }[] };

      // Second import of the same file
      const second = await postCsv(IMPORT_URL, csvContent);
      expect(second.statusCode).toBe(201);
      const secondBody = second.json() as { written: number; skipped: { row: number; naturalKey: string }[] };

      expect(secondBody.written).toBe(0);
      expect(secondBody.skipped.length).toBe(firstBody.written);
    });

    it('rejects a file with validation errors and writes nothing', async () => {
      // Build a minimal CSV with two bad rows:
      //   row 1: weight is not a number
      //   row 2: unknown lift abbreviation
      const badCsv = [
        'Program,Cycle #,Workout #,Date,Lift,Set #,Weight,Reps,Notes',
        'RPT,38,1,12/29/2025,Squat,1,not-a-number,8,',
        'RPT,38,1,12/29/2025,UnknownLift,2,180,8,',
      ].join('\n');

      const before = await prisma.liftRecord.count({
        where: { userId: TEST_USER, program: SEED_PROGRAM },
      });

      const res = await postCsv(IMPORT_URL, badCsv);
      expect(res.statusCode).toBe(400);

      const body = res.json() as { message: string; errors: { row: number; field?: string; message: string }[] };
      expect(body.errors.length).toBeGreaterThanOrEqual(2);
      // Errors should cover distinct field types
      const fields = body.errors.map((e) => e.field).filter(Boolean);
      expect(fields).toContain('weight');
      expect(fields).toContain('lift');

      // Nothing written
      const after = await prisma.liftRecord.count({
        where: { userId: TEST_USER, program: SEED_PROGRAM },
      });
      expect(after).toBe(before);
    });
  });
});

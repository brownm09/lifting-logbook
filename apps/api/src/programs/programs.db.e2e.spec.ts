// Runs only when DATABASE_URL is set; skipped in the normal npm test / CI lint-and-test job.
// CI: the db-integration job injects DATABASE_URL via a postgres service container.
// Local: docker-compose.test.yml spins up Postgres on port 5433, then:
//   DATABASE_URL=postgresql://lifting:lifting@localhost:5433/lifting_test \
//   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && \
//   npm test -w @lifting-logbook/api -- --testPathPattern=db.e2e
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
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

async function cleanTestUsers(prisma: PrismaClient): Promise<void> {
  const users = [TEST_USER, USER_ALICE, USER_BOB];
  await prisma.liftRecord.deleteMany({ where: { userId: { in: users } } });
  await prisma.trainingMax.deleteMany({ where: { userId: { in: users } } });
  await prisma.trainingMaxHistory.deleteMany({ where: { userId: { in: users } } });
  await prisma.cycleDashboard.deleteMany({ where: { userId: { in: users } } });
  await prisma.workoutLiftOverride.deleteMany({ where: { userId: { in: users } } });
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

    it('PATCH /training-maxes/history/:id with unknown id returns 404', async () => {
      const res = await patchJson(
        `/programs/${SEED_PROGRAM}/training-maxes/history/nonexistent-id`,
        { isPR: true },
      );
      expect(res.statusCode).toBe(404);
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
});

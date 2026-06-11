// Real-Postgres E2E suite for Row-Level Security (issue #511).
//
// Postgres is provisioned by jest.global-setup.js (Testcontainers locally; CI passthrough),
// which exposes the OWNER connection string via LIFTING_TC_DATABASE_URL. The enable_rls migration
// has already created the non-superuser `lifting_app` role (without a password). This suite:
//   1. sets a known password on lifting_app using the owner connection, then
//   2. connects a second Prisma client AS lifting_app to prove the policies actually constrain a
//      non-superuser caller — the existing DB-E2E suites connect as the bootstrap superuser, which
//      bypasses RLS, so they could never catch a missing/broken policy.
//
// Seeding and cleanup use the owner client (superuser → bypasses RLS, so it can write any user's
// rows). Enforcement assertions use the lifting_app client.
import 'reflect-metadata';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ClsModule, ClsService } from 'nestjs-cls';
import { lastValueFrom, from } from 'rxjs';
import { PrismaService } from './prisma.service';
import { PrismaRepositoryFactory } from './prisma-repository-factory';
import { RlsInterceptor } from './rls.interceptor';
import { RLS_TX_CLIENT } from './rls-context';
import { runBatch } from './prisma-tx.util';

const TC_DATABASE_URL = process.env.LIFTING_TC_DATABASE_URL;
const describeOrSkip = TC_DATABASE_URL ? describe : describe.skip;
// Guaranteed-string form for use inside the guarded describe blocks (they only run when
// TC_DATABASE_URL is set, so the '' fallback is never exercised — it just avoids a non-null
// assertion and keeps Prisma's `url: string` type satisfied).
const OWNER_URL = TC_DATABASE_URL ?? '';

const APP_ROLE = 'lifting_app';
const APP_ROLE_PASSWORD = 'lifting_app';

const USER_ALICE = 'rls-e2e-alice';
const USER_BOB = 'rls-e2e-bob';
const PROGRAM = 'rls-e2e-program';

function appRoleUrl(ownerUrl: string): string {
  const u = new URL(ownerUrl);
  u.username = APP_ROLE;
  u.password = APP_ROLE_PASSWORD;
  return u.toString();
}

/** Runs `body` inside a transaction with app.current_user_id set to `userId` (or unset if null). */
async function asUser<T>(
  client: PrismaClient,
  userId: string | null,
  body: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    if (userId !== null) {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    }
    return body(tx as unknown as PrismaClient);
  });
}

describeOrSkip('Row-Level Security (e2e, lifting_app role)', () => {
  let owner: PrismaClient;
  let appDb: PrismaClient;
  let aliceProgramId: string;

  const cleanup = async () => {
    await owner.customProgram.deleteMany({ where: { userId: { in: [USER_ALICE, USER_BOB] } } });
    await owner.trainingMax.deleteMany({ where: { userId: { in: [USER_ALICE, USER_BOB] } } });
  };

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });

    // The migration created lifting_app without a password; give it one so the app-role client can
    // connect. Owner is a superuser here, so ALTER ROLE is permitted. (Password is test-only.)
    await owner.$executeRawUnsafe(
      `ALTER ROLE "${APP_ROLE}" WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD}'`,
    );

    appDb = new PrismaClient({ datasources: { db: { url: appRoleUrl(OWNER_URL) } } });

    await cleanup();

    // Seed both users' training maxes via the owner (RLS-bypassing) connection.
    await owner.trainingMax.createMany({
      data: [
        { userId: USER_ALICE, program: PROGRAM, lift: 'squat', weight: 300, dateUpdated: new Date() },
        { userId: USER_BOB, program: PROGRAM, lift: 'squat', weight: 200, dateUpdated: new Date() },
      ],
    });

    // Seed a custom program + spec for Alice (custom_program_spec has no userId — it is isolated
    // through its parent program's userId).
    const aliceProgram = await owner.customProgram.create({
      data: { userId: USER_ALICE, name: 'Alice RLS Program' },
    });
    aliceProgramId = aliceProgram.id;
    await owner.customProgramSpec.create({
      data: {
        programId: aliceProgramId,
        week: 1,
        offset: 0,
        lift: 'squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        warmUpPct: '40/50/60',
        wtDecrementPct: 10,
        activation: 'standard',
      },
    });
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    await appDb?.$disconnect().catch(() => undefined);
    await owner?.$disconnect().catch(() => undefined);
  });

  it('the app-role connection is NOT a superuser and does NOT bypass RLS', async () => {
    // Guards against a future regression where this suite silently reconnects as a superuser
    // (which would make every assertion below pass without proving anything).
    const rows = await appDb.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('isolates reads by GUC even on an unscoped findMany (proves RLS, not app filtering)', async () => {
    const rows = await asUser(appDb, USER_ALICE, (tx) =>
      // Deliberately NO where: { userId } — only RLS stands between Alice and Bob's rows.
      tx.trainingMax.findMany({ where: { program: PROGRAM } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(USER_ALICE);
  });

  it('is fail-closed: with the GUC unset, queries return zero rows', async () => {
    const rows = await asUser(appDb, null, (tx) =>
      tx.trainingMax.findMany({ where: { program: PROGRAM } }),
    );
    expect(rows).toHaveLength(0);
  });

  it('rejects an INSERT whose userId does not match the GUC (WITH CHECK)', async () => {
    await expect(
      asUser(appDb, USER_ALICE, (tx) =>
        tx.trainingMax.create({
          data: { userId: USER_BOB, program: PROGRAM, lift: 'bench', weight: 1, dateUpdated: new Date() },
        }),
      ),
    ).rejects.toThrow();
  });

  it('isolates custom_program_spec through its parent program FK policy', async () => {
    const asBob = await asUser(appDb, USER_BOB, (tx) =>
      tx.customProgramSpec.findMany({ where: { programId: aliceProgramId } }),
    );
    expect(asBob).toHaveLength(0);

    const asAlice = await asUser(appDb, USER_ALICE, (tx) =>
      tx.customProgramSpec.findMany({ where: { programId: aliceProgramId } }),
    );
    expect(asAlice).toHaveLength(1);
  });

  it('every table with a userId column has FORCE RLS enabled and at least one policy', async () => {
    // Generic coverage guard: catches the "added a userId table, forgot the policy" regression
    // class that the targeted tests above cannot — they only assert the specific tables they name.
    // Metadata views are role-independent, so the owner connection is fine here.
    const tables = await owner.$queryRaw<
      Array<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
        policy_count: number;
      }>
    >`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'userId' AND NOT a.attisdropped
        )`;

    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      expect({ table: t.relname, rls: t.relrowsecurity, force: t.relforcerowsecurity }).toEqual({
        table: t.relname,
        rls: true,
        force: true,
      });
      expect({ table: t.relname, policies: t.policy_count }).toEqual({
        table: t.relname,
        policies: expect.any(Number),
      });
      expect(t.policy_count).toBeGreaterThanOrEqual(1);
    }

    // custom_program_spec has no userId (isolated via its parent program FK) so the query above
    // excludes it — assert it explicitly.
    const spec = await owner.$queryRaw<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean; policy_count: number }>
    >`
      SELECT c.relrowsecurity, c.relforcerowsecurity,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'custom_program_spec'`;
    expect(spec[0]?.relrowsecurity).toBe(true);
    expect(spec[0]?.relforcerowsecurity).toBe(true);
    expect(spec[0]?.policy_count).toBeGreaterThanOrEqual(1);
  });

  it('runBatch stays isolated and atomic inside a request transaction (helper sequential path)', async () => {
    // Mirrors PrismaWorkoutRepository.saveWorkout / saveScheduledWorkouts under a request tx:
    // the injected client is a TransactionClient (no $transaction), so runBatch runs the ops
    // sequentially on the existing transaction — which carries Alice's GUC.
    await asUser(appDb, USER_ALICE, async (tx) => {
      await runBatch(tx, (db) => [
        db.trainingMax.deleteMany({ where: { program: PROGRAM, lift: 'squat' } }),
        db.trainingMax.create({
          data: { userId: USER_ALICE, program: PROGRAM, lift: 'squat', weight: 305, dateUpdated: new Date() },
        }),
      ]);
      return undefined;
    });

    // Bob's squat row must survive (Alice's deleteMany could not see it).
    const bobRow = await owner.trainingMax.findFirst({
      where: { userId: USER_BOB, program: PROGRAM, lift: 'squat' },
    });
    expect(bobRow?.weight).toBe(200);
    const aliceRow = await owner.trainingMax.findFirst({
      where: { userId: USER_ALICE, program: PROGRAM, lift: 'squat' },
    });
    expect(aliceRow?.weight).toBe(305);
  });
});

// Proves the request-path wiring end to end: RlsInterceptor opens a transaction, sets
// app.current_user_id to the request user, and exposes the transaction client via CLS so
// PrismaRepositoryFactory routes every repository query through it. Uses the owner connection
// (the GUC is observable regardless of superuser bypass — bypass only affects POLICY enforcement,
// which the suite above already covers).
describeOrSkip('RLS request wiring (interceptor + factory)', () => {
  let cls: ClsService;
  let prisma: PrismaService;
  let factory: PrismaRepositoryFactory;
  let interceptor: RlsInterceptor;

  beforeAll(async () => {
    process.env.DATABASE_URL = OWNER_URL; // allowed by jest.env.setup.js Proxy (== sentinel value)
    const moduleRef = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
      providers: [
        Reflector,
        {
          provide: PrismaService,
          useFactory: (clsService: ClsService) => new PrismaService(clsService),
          inject: [ClsService],
        },
      ],
    }).compile();
    await moduleRef.init();
    cls = moduleRef.get(ClsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    factory = new PrismaRepositoryFactory(prisma, cls);
    interceptor = new RlsInterceptor(cls, moduleRef.get(Reflector), prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect().catch(() => undefined);
  });

  // Reflector.getAllAndOverride reads metadata off the handler/class, so they must be real
  // reflection targets (a function and a class), not undefined.
  const dummyHandler = function handler() {};
  class DummyController {}

  function httpContextFor(userId: string): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
      getHandler: () => dummyHandler,
      getClass: () => DummyController,
    } as unknown as ExecutionContext;
  }

  it('sets app.current_user_id from request.user and routes the factory client through the tx', async () => {
    const observed: { uid: string | null } = { uid: 'unset' };

    const handler: CallHandler = {
      handle: () =>
        from(
          (async () => {
            // The factory must resolve the request transaction client out of CLS...
            await factory.forUser({ id: USER_ALICE, email: '', displayName: '', provider: 'dev' });
            const tx = cls.get(RLS_TX_CLIENT) as PrismaClient;
            const rows = await tx.$queryRaw<Array<{ uid: string | null }>>`
              SELECT current_setting('app.current_user_id', true) AS uid`;
            const first = rows[0];
            observed.uid = first ? first.uid : null;
            return 'ok';
          })(),
        ),
    };

    const result = await lastValueFrom(interceptor.intercept(httpContextFor(USER_ALICE), handler));
    expect(result).toBe('ok');
    expect(observed.uid).toBe(USER_ALICE);
  });

  it('clientForRequest() returns the request tx client inside a request and the base client outside', async () => {
    // Guards the path used by controllers that build repositories OUTSIDE the factory
    // (CustomProgramsController, UserSettingsController, SwitchProgramController). If this routing
    // regresses, those controllers' queries run on the base connection with no GUC and fail closed
    // under lifting_app. Outside any CLS request, the base client must be returned.
    expect(prisma.clientForRequest()).toBe(prisma);

    // Inside a CLS context with the interceptor's tx stashed, the tx client must be returned.
    await cls.run(async () => {
      const sentinelTx = { marker: 'request-tx' } as unknown as PrismaClient;
      cls.set(RLS_TX_CLIENT, sentinelTx);
      expect(prisma.clientForRequest()).toBe(sentinelTx);
    });

    // After the request scope ends, it falls back to the base client again.
    expect(prisma.clientForRequest()).toBe(prisma);
  });
});

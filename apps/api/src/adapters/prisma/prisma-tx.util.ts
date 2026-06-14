import { Prisma, PrismaClient } from '@prisma/client';

/**
 * A Prisma client capable of running queries: either the base client (which can open
 * transactions) or an interactive-transaction client (which cannot — it is already inside a
 * transaction). The RLS request interceptor (rls.interceptor.ts) routes every repository through
 * a per-request transaction client so the `app.current_user_id` GUC stays in scope; outside an
 * HTTP request (in-memory factory, standalone unit tests) repositories get the base client.
 */
export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

/**
 * The base client can start transactions; Prisma's interactive transaction client cannot
 * (it exposes no `$transaction`). This is the runtime discriminator between the two.
 */
function canStartTransaction(client: PrismaExecutor): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === 'function';
}

/**
 * Run a set of writes atomically. With the base client this opens a batch transaction; with a
 * request-scoped transaction client the writes are already inside a transaction, so they run
 * sequentially on it (Prisma's tx client supports no nested `$transaction`). Either way the caller
 * gets all-or-nothing semantics — for the request-scoped case, because the enclosing request
 * transaction rolls back on any thrown error.
 */
export async function runBatch(
  client: PrismaExecutor,
  build: (c: PrismaExecutor) => Prisma.PrismaPromise<unknown>[],
): Promise<void> {
  const ops = build(client);
  if (canStartTransaction(client)) {
    await client.$transaction(ops);
  } else {
    for (const op of ops) {
      await op;
    }
  }
}

/**
 * Interactive-transaction options for batch import writes (#532). A large (but
 * within-limit) import can exceed Prisma's 5s default interactive-tx timeout and
 * throw P2028 — but only on the self-opened-tx path (the system-DB factory / unit
 * tests, where the repository holds the base client). On the request path
 * `runInteractive` reuses the RLS request transaction and these options are
 * ignored (the RLS interceptor owns that transaction's timeout). `maxWait` is
 * raised in step so a busy pool does not P2028 while acquiring the connection.
 */
export const IMPORT_BATCH_TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 } as const;

/**
 * Run an interactive transaction. With the base client this opens one; with a request-scoped
 * transaction client it reuses the current transaction (Prisma does not nest interactive
 * transactions, and reusing the request transaction keeps the RLS GUC in scope).
 *
 * `options` (timeout / maxWait) apply only when this opens its own transaction; on the
 * reuse path the enclosing request transaction's own timeout governs.
 */
export async function runInteractive<T>(
  client: PrismaExecutor,
  fn: (tx: PrismaExecutor) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  if (canStartTransaction(client)) {
    return client.$transaction((tx) => fn(tx), options);
  }
  return fn(client);
}

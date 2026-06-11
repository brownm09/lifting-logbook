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
 * Run an interactive transaction. With the base client this opens one; with a request-scoped
 * transaction client it reuses the current transaction (Prisma does not nest interactive
 * transactions, and reusing the request transaction keeps the RLS GUC in scope).
 */
export async function runInteractive<T>(
  client: PrismaExecutor,
  fn: (tx: PrismaExecutor) => Promise<T>,
): Promise<T> {
  if (canStartTransaction(client)) {
    return client.$transaction((tx) => fn(tx));
  }
  return fn(client);
}

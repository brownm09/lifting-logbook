import { SetMetadata } from '@nestjs/common';

/**
 * CLS key under which the per-request RLS interactive-transaction client is stored.
 * PrismaRepositoryFactory reads it so every repository in a request shares the one transaction
 * on which `app.current_user_id` was set. See rls.interceptor.ts.
 */
export const RLS_TX_CLIENT = 'rls.txClient';

/**
 * Default timeout (ms) for the per-request RLS interactive transaction. Normal CRUD requests
 * finish well within this; the transaction also bounds how long a single request may hold its
 * DB connection. Override per-handler with {@link RlsTxTimeout} for endpoints that legitimately
 * run longer.
 */
export const DEFAULT_RLS_TX_TIMEOUT_MS = 15_000;

/** Reflector metadata key for a per-handler RLS transaction timeout override. */
export const RLS_TX_TIMEOUT_KEY = 'rls.txTimeoutMs';

/**
 * Override the per-request RLS transaction timeout (ms) for a route handler. Use sparingly: the
 * request holds one DB connection for the whole transaction, so a long timeout pins a connection
 * for that duration. The motivating case is `cycle-plan`, which calls an LLM between DB reads.
 */
export const RlsTxTimeout = (ms: number) => SetMetadata(RLS_TX_TIMEOUT_KEY, ms);

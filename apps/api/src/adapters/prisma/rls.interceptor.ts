import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Observable, defaultIfEmpty, from, lastValueFrom } from 'rxjs';
import { PrismaService } from './prisma.service';
import {
  DEFAULT_RLS_TX_TIMEOUT_MS,
  RLS_TX_CLIENT,
  RLS_TX_TIMEOUT_KEY,
} from './rls-context';

/**
 * Establishes the per-request Postgres Row-Level Security context (issue #511).
 *
 * For every authenticated HTTP request that reaches the Prisma-backed factory, it opens one
 * interactive transaction, sets the `app.current_user_id` GUC (a SET LOCAL, via `set_config`) so
 * RLS policies resolve to the caller, and stores the transaction client in CLS so
 * PrismaRepositoryFactory routes every repository query through it. The GUC is transaction-local,
 * which is why all of a request's DB work shares a single transaction.
 *
 * No-ops when there is no Prisma client (in-memory / SystemDb factories) or no authenticated user
 * (public routes such as /health and /readyz). Those run on the base client with no GUC — which is
 * fail-closed for any userId-scoped table (zero rows) and harmless for the table-less probes.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  private readonly tracer = trace.getTracer('rls-interceptor');

  constructor(
    private readonly cls: ClsService,
    private readonly reflector: Reflector,
    @Optional() private readonly prisma: PrismaService | null = null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const prisma = this.prisma;
    // Only the HTTP path is RLS-wired today; `apps/api` exposes no GraphQL resolvers
    // (no GraphQLModule). If GraphQL resolvers touching userId tables are ever added, this guard
    // must be broadened to the 'graphql' context type — otherwise those queries skip the GUC and
    // fail closed (zero rows) under lifting_app rather than scoping correctly. See issue #511.
    if (!prisma || context.getType() !== 'http') {
      return next.handle();
    }
    // routerPath is the Fastify property for the matched route pattern (e.g. /programs/:id).
    // request.url is the full URL with query params — used as fallback only.
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string }; routerPath?: string; url?: string }>();
    const userId = request?.user?.id;
    if (!userId) {
      return next.handle();
    }

    const timeoutMs =
      this.reflector.getAllAndOverride<number>(RLS_TX_TIMEOUT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RLS_TX_TIMEOUT_MS;

    const route = request?.routerPath ?? request?.url ?? 'unknown';
    return from(this.cls.run(() => this.runWithRlsContext(prisma, userId, timeoutMs, route, next)));
  }

  private runWithRlsContext(
    prisma: PrismaService,
    userId: string,
    timeoutMs: number,
    route: string,
    next: CallHandler,
  ): Promise<unknown> {
    return this.tracer.startActiveSpan('rls.transaction', async (span) => {
      span.setAttribute('rls.userId', userId);
      span.setAttribute('rls.route', route);
      try {
        return await prisma.$transaction(
          async (tx) => {
            await this.setUserContext(tx, userId);
            this.cls.set(RLS_TX_CLIENT, tx);
            return lastValueFrom(next.handle().pipe(defaultIfEmpty(undefined)));
          },
          { timeout: timeoutMs },
        );
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2028') {
          span.setAttribute('rls.transaction.timeout', true);
        }
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  private async setUserContext(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    // Raw SQL is not auto-traced (ADR-024) — wrap it in a manual span. `set_config(_, _, true)`
    // is the transaction-local (SET LOCAL) form and, unlike `SET LOCAL`, accepts a bind parameter.
    await this.tracer.startActiveSpan('rls.set_user_context', async (span) => {
      try {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      } finally {
        span.end();
      }
    });
  }
}

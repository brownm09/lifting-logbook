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
import { trace } from '@opentelemetry/api';
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
    if (!prisma || context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = request?.user?.id;
    if (!userId) {
      return next.handle();
    }

    const timeoutMs =
      this.reflector.getAllAndOverride<number>(RLS_TX_TIMEOUT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RLS_TX_TIMEOUT_MS;

    return from(this.cls.run(() => this.runWithRlsContext(prisma, userId, timeoutMs, next)));
  }

  private runWithRlsContext(
    prisma: PrismaService,
    userId: string,
    timeoutMs: number,
    next: CallHandler,
  ): Promise<unknown> {
    return prisma.$transaction(
      async (tx) => {
        await this.setUserContext(tx, userId);
        this.cls.set(RLS_TX_CLIENT, tx);
        return lastValueFrom(next.handle().pipe(defaultIfEmpty(undefined)));
      },
      { timeout: timeoutMs },
    );
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

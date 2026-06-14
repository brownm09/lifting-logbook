import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { FastifyReply } from 'fastify';

/**
 * Maps Prisma's P2028 (interactive-transaction timeout / already-closed) to HTTP
 * 503 so a batch import — or any write — that exceeds its transaction window
 * returns an actionable response instead of a generic 500 (issue #532). A P2028
 * can surface two ways: the per-request RLS transaction timing out (the RLS
 * interceptor re-throws it), or a self-opened batch-import transaction exceeding
 * its timeout (the system-DB factory / non-RLS path).
 *
 * Only P2028 is handled here; every other `PrismaClientKnownRequestError` is
 * delegated to the framework default (`BaseExceptionFilter`) so its standard 500
 * **and Nest's error logging** are preserved. Most Prisma known errors (P2002,
 * P2025) are already translated to domain errors by the adapters and should never
 * reach this filter — but any that do must still be logged, not silently reshaped.
 */
@Catch(PrismaClientKnownRequestError)
export class PrismaTransactionTimeoutFilter extends BaseExceptionFilter {
  override catch(err: PrismaClientKnownRequestError, host: ArgumentsHost): void {
    if (err.code !== 'P2028') {
      super.catch(err, host);
      return;
    }
    const res = host.switchToHttp().getResponse<FastifyReply>();
    res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message:
        'The import took too long to process and was rolled back. Try again, or split the file into smaller batches.',
      error: 'Service Unavailable',
    });
  }
}

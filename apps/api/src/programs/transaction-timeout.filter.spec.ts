import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaTransactionTimeoutFilter } from './transaction-timeout.filter';

function mkError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

function mkHost(reply: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;
}

describe('PrismaTransactionTimeoutFilter', () => {
  it('maps P2028 (transaction timeout) to HTTP 503', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = mkHost({ status });

    new PrismaTransactionTimeoutFilter().catch(mkError('P2028'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
      }),
    );
  });

  it('delegates non-P2028 Prisma errors to the base filter (preserving default 500 + logging)', () => {
    const superCatch = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = mkHost({ status });
    const err = mkError('P2002');

    new PrismaTransactionTimeoutFilter().catch(err, host);

    expect(superCatch).toHaveBeenCalledWith(err, host);
    expect(status).not.toHaveBeenCalled(); // did not send its own response
    superCatch.mockRestore();
  });
});

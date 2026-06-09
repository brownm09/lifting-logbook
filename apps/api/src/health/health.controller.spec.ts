import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../adapters/prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health returns status ok with an ISO timestamp', () => {
    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('GET /health does not touch the database (liveness must survive a DB outage)', () => {
    controller.health();

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('GET /readyz returns status ready when the database round-trips', async () => {
    // Resolve the SELECT 1 round-trip — proves readiness exercises the DB and
    // returns the ready payload (a data-level assertion the failure path below
    // would not produce).
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.readyz();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('GET /readyz throws 503 when the database query fails', async () => {
    // The catch re-raises as 503 rather than swallowing to a neutral value, so
    // a deploy-time smoke test sees a non-200 when the DB is unreachable
    // (error-fallback-test-coverage.md: this is a fail-path, not a swallow).
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.readyz()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

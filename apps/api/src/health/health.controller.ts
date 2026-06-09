import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../adapters/prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: the process is up. Deliberately does NOT touch the database, so a
  // DB outage does not cause liveness probes to kill an otherwise-healthy
  // process. Use /readyz to gate traffic on database readiness.
  @Public()
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Readiness: the process can actually serve database-backed requests. Runs a
  // trivial round-trip (`SELECT 1`) so a deploy-time smoke test can distinguish
  // "API up but can't reach/serve the DB" (503) from "API up" (200) — the class
  // of failure that left prod 500ing in #458/#460 invisible until a user
  // noticed. Public + DB-only (no Clerk), so the deploy pipeline can probe it
  // with just a Cloud Run identity token. Schema *completeness* is guarded
  // earlier by the pre-deploy `prisma migrate status` check (ADR-027); this
  // guards live DB connectivity/serving.
  @Public()
  @Get('readyz')
  async readyz(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      throw new ServiceUnavailableException('database not ready', { cause: e });
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}

import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { resolveDeploymentEnvironment } from '../otel';

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

  // Deployment identity: what commit this process is running. GIT_SHA is baked
  // into the image at Docker build time (apps/api/Dockerfile's runner stage) —
  // it's a property of the build, not the environment, so unlike PUBLIC_API_URL
  // -style config (ADR-028) it's safe to bake in rather than inject at deploy
  // time: it never differs per destination for a given build. A missing
  // GIT_SHA only degrades observability, not functionality, so this degrades
  // to 'unknown' rather than throwing. See #671.
  @Public()
  @Get('version')
  version(): { gitSha: string; environment: string } {
    return {
      gitSha: process.env.GIT_SHA ?? 'unknown',
      environment: resolveDeploymentEnvironment(),
    };
  }
}

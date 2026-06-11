import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ClsModule } from 'nestjs-cls';
import { trace, context } from '@opentelemetry/api';
import { RepositoryFactoryModule } from './adapters/factory/repository-factory.module';
import { AuthModule } from './auth/auth.module';
import { CustomProgramsModule } from './custom-programs/custom-programs.module';
import { HealthModule } from './health/health.module';
import { LiftsModule } from './lifts/lifts.module';
import { ProgramsModule } from './programs/programs.module';
import { UserSettingsModule } from './user-settings/user-settings.module';

@Module({
  imports: [
    // Provides ClsService (AsyncLocalStorage) globally. The RLS interceptor manages the context
    // itself via cls.run() per request, so no auto-mounted middleware/guard is needed here.
    ClsModule.forRoot({ global: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Strip auth-bearing headers before they reach Loki. pino-http's default
        // req serializer logs req.headers verbatim, which would otherwise leak
        // JWTs and session cookies into long-retention log storage.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["set-cookie"]',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        // K8s liveness/readiness probes hit /health on every replica every few
        // seconds; auto-logging that path inflates Grafana Cloud log spend
        // without adding signal.
        autoLogging: {
          ignore: (req) => req.url === '/health',
        },
        mixin() {
          const span = trace.getSpan(context.active());
          if (!span) return {};
          const { traceId, spanId } = span.spanContext();
          return { trace_id: traceId, span_id: spanId };
        },
      },
    }),
    AuthModule,
    CustomProgramsModule,
    HealthModule,
    LiftsModule,
    ProgramsModule,
    RepositoryFactoryModule,
    UserSettingsModule,
  ],
})
export class AppModule {}

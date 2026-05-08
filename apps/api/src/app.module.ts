import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { trace, context } from '@opentelemetry/api';
import { RepositoryFactoryModule } from './adapters/factory/repository-factory.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LiftsModule } from './lifts/lifts.module';
import { ProgramsModule } from './programs/programs.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        mixin() {
          const span = trace.getSpan(context.active());
          if (!span) return {};
          const { traceId, spanId } = span.spanContext();
          return { trace_id: traceId, span_id: spanId };
        },
      },
    }),
    AuthModule,
    HealthModule,
    LiftsModule,
    ProgramsModule,
    RepositoryFactoryModule,
  ],
})
export class AppModule {}

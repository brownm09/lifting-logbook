// MUST be the first import. otel.ts starts the OpenTelemetry NodeSDK, which
// uses require-in-the-middle to patch http, pg, @prisma/client, etc. Any module
// that pulls those in before this line will not be instrumented. Do not let an
// import sorter (ESLint sort-imports / Prettier organize-imports) move it.
import './otel';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DomainNotFoundFilter } from './programs/not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(multipart as any, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new DomainNotFoundFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  const port = parseInt(process.env.PORT ?? '3004', 10);
  await app.listen(port, '0.0.0.0');
}

bootstrap();

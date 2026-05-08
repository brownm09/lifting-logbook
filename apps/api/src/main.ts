import './otel';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DomainNotFoundFilter } from './programs/not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new DomainNotFoundFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  const port = parseInt(process.env.PORT ?? '3004', 10);
  await app.listen(port, '0.0.0.0');
}

bootstrap();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { DomainNotFoundFilter } from './programs/not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new DomainNotFoundFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000, '0.0.0.0');
}

bootstrap();

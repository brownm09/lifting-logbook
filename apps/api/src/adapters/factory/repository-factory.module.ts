import { Global, Module } from '@nestjs/common';
import { InMemoryRepositoryFactory } from './in-memory-repository-factory';
import { SystemDbRepositoryFactory } from './system-db-repository-factory';
import { REPOSITORY_FACTORY } from '../../ports/tokens';

@Global()
@Module({
  providers: [
    {
      provide: REPOSITORY_FACTORY,
      useClass: process.env.SYSTEM_DATABASE_URL
        ? SystemDbRepositoryFactory
        : InMemoryRepositoryFactory,
    },
  ],
  exports: [REPOSITORY_FACTORY],
})
export class RepositoryFactoryModule {}

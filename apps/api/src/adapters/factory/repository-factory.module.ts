import { Global, Module } from '@nestjs/common';
import { InMemoryRepositoryFactory } from './in-memory-repository-factory';
import { SystemDbRepositoryFactory } from './system-db-repository-factory';
import { REPOSITORY_FACTORY } from '../../ports/tokens';

@Global()
@Module({
  providers: [
    {
      provide: REPOSITORY_FACTORY,
      useFactory: () =>
        process.env.SYSTEM_DATABASE_URL
          ? new SystemDbRepositoryFactory()
          : new InMemoryRepositoryFactory(),
    },
  ],
  exports: [REPOSITORY_FACTORY],
})
export class RepositoryFactoryModule {}

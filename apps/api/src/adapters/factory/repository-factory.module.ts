import { Global, Module } from '@nestjs/common';
import { InMemoryRepositoryFactory } from './in-memory-repository-factory';
import { SystemDbRepositoryFactory } from './system-db-repository-factory';
import { PrismaRepositoryFactory } from '../prisma/prisma-repository-factory';
import { PrismaService } from '../prisma/prisma.service';
import { REPOSITORY_FACTORY } from '../../ports/tokens';

@Global()
@Module({
  providers: [
    // Only instantiate PrismaService (and load the Prisma engine binary) when DATABASE_URL is set.
    {
      provide: PrismaService,
      useFactory: () => (process.env.DATABASE_URL ? new PrismaService() : null),
    },
    {
      provide: REPOSITORY_FACTORY,
      useFactory: (prisma: PrismaService | null) => {
        if (process.env.DATABASE_URL && prisma) {
          return new PrismaRepositoryFactory(prisma);
        }
        if (process.env.SYSTEM_DATABASE_URL) {
          return new SystemDbRepositoryFactory();
        }
        return new InMemoryRepositoryFactory();
      },
      inject: [{ token: PrismaService, optional: true }],
    },
  ],
  exports: [REPOSITORY_FACTORY],
})
export class RepositoryFactoryModule {}

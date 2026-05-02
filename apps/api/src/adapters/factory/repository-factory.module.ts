import { Global, Module } from '@nestjs/common';
import { InMemoryRepositoryFactory } from './in-memory-repository-factory';
import { SystemDbRepositoryFactory } from './system-db-repository-factory';
import { PrismaRepositoryFactory } from '../prisma/prisma-repository-factory';
import { PrismaService } from '../prisma/prisma.service';
import { REPOSITORY_FACTORY } from '../../ports/tokens';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: REPOSITORY_FACTORY,
      useFactory: (prisma: PrismaService) => {
        if (process.env.DATABASE_URL) {
          return new PrismaRepositoryFactory(prisma);
        }
        if (process.env.SYSTEM_DATABASE_URL) {
          return new SystemDbRepositoryFactory();
        }
        return new InMemoryRepositoryFactory();
      },
      inject: [PrismaService],
    },
  ],
  exports: [REPOSITORY_FACTORY],
})
export class RepositoryFactoryModule {}

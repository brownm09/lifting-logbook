import { Module } from '@nestjs/common';
import { RepositoryFactoryModule } from './adapters/factory/repository-factory.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProgramsModule } from './programs/programs.module';

@Module({
  imports: [AuthModule, HealthModule, ProgramsModule, RepositoryFactoryModule],
})
export class AppModule {}

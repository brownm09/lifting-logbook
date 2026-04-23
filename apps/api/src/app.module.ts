import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ProgramsModule } from './programs/programs.module';

@Module({
  imports: [HealthModule, ProgramsModule],
})
export class AppModule {}

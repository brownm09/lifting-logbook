import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProgramsModule } from './programs/programs.module';

@Module({
  imports: [AuthModule, HealthModule, ProgramsModule],
})
export class AppModule {}

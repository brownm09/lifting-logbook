import { Module } from '@nestjs/common';
import { CustomProgramsController } from './custom-programs.controller';

@Module({
  controllers: [CustomProgramsController],
})
export class CustomProgramsModule {}

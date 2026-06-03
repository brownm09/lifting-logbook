import { Module } from '@nestjs/common';
import { CustomLiftController } from './custom-lift.controller';
import { LiftMetadataController } from './lift-metadata.controller';

@Module({
  controllers: [LiftMetadataController, CustomLiftController],
})
export class LiftsModule {}

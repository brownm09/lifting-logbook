import { Module } from '@nestjs/common';
import { LiftMetadataController } from './lift-metadata.controller';

@Module({
  controllers: [LiftMetadataController],
})
export class LiftsModule {}

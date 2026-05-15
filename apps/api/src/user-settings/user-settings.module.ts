import { Module } from '@nestjs/common';
import { UserSettingsController } from './user-settings.controller';

@Module({
  controllers: [UserSettingsController],
})
export class UserSettingsModule {}

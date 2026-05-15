import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { UserSettingsResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { UserSettingsRepository } from './user-settings.repository';
import { UpdateSettingsDto } from './update-settings.dto';

@Controller('users/me/settings')
export class UserSettingsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async getSettings(@CurrentUser() user: AuthUser): Promise<UserSettingsResponse> {
    const repo = new UserSettingsRepository(this.prisma, user.id);
    return repo.getSettings();
  }

  @Patch()
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    const repo = new UserSettingsRepository(this.prisma, user.id);
    return repo.upsertSettings(dto);
  }
}

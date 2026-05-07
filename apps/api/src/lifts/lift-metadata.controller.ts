import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
} from '@nestjs/common';
import { LiftMetadataResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { PatchLiftMetadataDto } from './patch-lift-metadata.dto';

@Controller('lifts')
export class LiftMetadataController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get(':lift/metadata')
  async getMetadata(
    @Param('lift') lift: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftMetadataResponse> {
    const { liftMetadata } = await this.factory.forUser(user);
    const meta = await liftMetadata.getMetadata(lift);
    return meta
      ? {
          lift: meta.lift,
          muscleGroups: meta.muscleGroups,
          substitutions: meta.substitutions,
          foundational: meta.foundational,
        }
      : { lift, muscleGroups: [], substitutions: [], foundational: false };
  }

  @Patch(':lift/metadata')
  @HttpCode(HttpStatus.OK)
  async patchMetadata(
    @Param('lift') lift: string,
    @Body() dto: PatchLiftMetadataDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftMetadataResponse> {
    const { liftMetadata } = await this.factory.forUser(user);
    const patch: { muscleGroups?: string[]; substitutions?: string[]; foundational?: boolean } = {};
    if (dto.muscleGroups !== undefined) patch.muscleGroups = dto.muscleGroups;
    if (dto.substitutions !== undefined) patch.substitutions = dto.substitutions;
    if (dto.foundational !== undefined) patch.foundational = dto.foundational;
    const meta = await liftMetadata.upsertMetadata(lift, patch);
    return {
      lift: meta.lift,
      muscleGroups: meta.muscleGroups,
      substitutions: meta.substitutions,
      foundational: meta.foundational,
    };
  }
}

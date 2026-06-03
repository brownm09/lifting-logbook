import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomLift, CustomLiftResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { UpdateCustomLiftPatch } from '../ports/ICustomLiftRepository';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { CreateCustomLiftDto } from './create-custom-lift.dto';
import { UpdateCustomLiftDto } from './update-custom-lift.dto';

function toCustomLiftResponse(lift: CustomLift): CustomLiftResponse {
  return {
    id: lift.id,
    name: lift.name,
    classification: lift.classification,
    movementTags: lift.movementTags,
    isBodyweightComponent: lift.isBodyweightComponent ?? false,
    isCustom: true,
    createdAt: lift.createdAt.toISOString(),
  };
}

@Controller('lifts')
export class CustomLiftController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('custom')
  async list(@CurrentUser() user: AuthUser): Promise<CustomLiftResponse[]> {
    const { customLift } = await this.factory.forUser(user);
    const lifts = await customLift.list();
    return lifts.map(toCustomLiftResponse);
  }

  @Post('custom')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCustomLiftDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomLiftResponse> {
    const { customLift } = await this.factory.forUser(user);
    const created = await customLift.create({
      name: dto.name,
      classification: dto.classification,
      ...(dto.movementTags !== undefined ? { movementTags: dto.movementTags } : {}),
      ...(dto.isBodyweightComponent !== undefined
        ? { isBodyweightComponent: dto.isBodyweightComponent }
        : {}),
    });
    return toCustomLiftResponse(created);
  }

  @Patch('custom/:id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomLiftDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomLiftResponse> {
    const { customLift } = await this.factory.forUser(user);
    const patch: UpdateCustomLiftPatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.classification !== undefined) patch.classification = dto.classification;
    if (dto.movementTags !== undefined) patch.movementTags = dto.movementTags;
    if (dto.isBodyweightComponent !== undefined) {
      patch.isBodyweightComponent = dto.isBodyweightComponent;
    }
    const updated = await customLift.update(id, patch);
    return toCustomLiftResponse(updated);
  }

  @Delete('custom/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    const { customLift } = await this.factory.forUser(user);
    await customLift.delete(id);
  }
}

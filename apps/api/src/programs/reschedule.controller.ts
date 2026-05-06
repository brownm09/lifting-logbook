import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { isValidWorkoutNum } from './mappers';
import { RescheduleDto } from './reschedule.dto';

@Controller('programs/:program')
export class RescheduleController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Patch('cycles/:cycleNum/workouts/:workoutNum/reschedule')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reschedule(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
    @Body() dto: RescheduleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const cycleNum = Number.parseInt(cycleNumParam, 10);
    const workoutNum = Number.parseInt(workoutNumParam, 10);

    if (!Number.isInteger(cycleNum) || cycleNum < 1) {
      throw new BadRequestException('cycleNum must be a positive integer');
    }
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException('workoutNum must be a positive integer');
    }

    const { workoutDateOverride, liftingProgramSpec } = await this.factory.forUser(user);

    const spec = await liftingProgramSpec.getProgramSpec(program);
    if (spec.length === 0) {
      throw new NotFoundException(`Program '${program}' not found`);
    }

    // Append explicit UTC midnight so the YYYY-MM-DD string is stored as the correct calendar day
    // regardless of the server's local timezone.
    await workoutDateOverride.upsertOverride(
      program,
      cycleNum,
      workoutNum,
      new Date(dto.newDate + 'T00:00:00Z'),
    );
  }
}

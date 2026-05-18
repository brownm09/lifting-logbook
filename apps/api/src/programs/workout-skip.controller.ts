import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { isValidWorkoutNum } from './mappers';

class SkipWorkoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller('programs/:program')
export class WorkoutSkipController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Post('cycles/:cycleNum/workouts/:workoutNum/skip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async skipWorkout(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
    @Body() dto: SkipWorkoutDto,
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

    const { workoutSkipOverride } = await this.factory.forUser(user);
    await workoutSkipOverride.skipWorkout(program, cycleNum, workoutNum, dto.reason);
  }

  @Delete('cycles/:cycleNum/workouts/:workoutNum/skip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unskipWorkout(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
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

    const { workoutSkipOverride } = await this.factory.forUser(user);
    await workoutSkipOverride.unskipWorkout(program, cycleNum, workoutNum);
  }
}

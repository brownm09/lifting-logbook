import { IsString, Matches } from 'class-validator';

export class RescheduleDto {
  /** Calendar date in YYYY-MM-DD format. Time and timezone components are not accepted. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'newDate must be a calendar date in YYYY-MM-DD format' })
  newDate!: string;
}

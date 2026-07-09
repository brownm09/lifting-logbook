import { IsString, Matches } from 'class-validator';
import { RescheduleRequest } from '@lifting-logbook/types';

// `implements RescheduleRequest` ties this validated DTO to the shared request
// contract in @lifting-logbook/types: if the contract's shape changes, this
// class fails to compile until the validation is updated to match.
export class RescheduleDto implements RescheduleRequest {
  /** Calendar date in YYYY-MM-DD format. Time and timezone components are not accepted. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'newDate must be a calendar date in YYYY-MM-DD format' })
  newDate!: string;
}

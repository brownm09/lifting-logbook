import { IsIn, IsString, ValidateIf } from 'class-validator';
import { LiftOverrideAction } from '@lifting-logbook/types';

export class LiftOverrideDto {
  @IsIn(['add', 'remove', 'replace'])
  action!: LiftOverrideAction;

  @IsString()
  lift!: string;

  /** Required when action is 'replace'. */
  @ValidateIf((o: LiftOverrideDto) => o.action === 'replace')
  @IsString()
  replacedBy?: string;
}

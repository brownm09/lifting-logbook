import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomProgramSpecRowDto } from './create-custom-program.dto';

export class UpdateCustomProgramDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomProgramSpecRowDto)
  specs?: CustomProgramSpecRowDto[];
}

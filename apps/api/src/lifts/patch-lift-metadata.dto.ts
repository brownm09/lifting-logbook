import { IsArray, IsOptional, IsString } from 'class-validator';

export class PatchLiftMetadataDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  muscleGroups?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  substitutions?: string[];

  @IsString()
  @IsOptional()
  foundational?: string;
}

import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const PROGRAM_PATTERN = /^[a-zA-Z0-9_-]+$/;

@Injectable()
export class ParseProgramPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!PROGRAM_PATTERN.test(value)) {
      throw new BadRequestException(
        `Program identifier must contain only letters, digits, hyphens, and underscores`,
      );
    }
    return value;
  }
}

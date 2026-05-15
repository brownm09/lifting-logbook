import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Accepts catalog slugs (e.g. "5-3-1") and UUID-shaped custom program IDs
// (e.g. "550e8400-e29b-41d4-a716-446655440000") — both match [a-zA-Z0-9_-].
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

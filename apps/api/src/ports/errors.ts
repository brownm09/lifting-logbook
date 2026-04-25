/**
 * Framework-agnostic errors raised by port adapters. Controllers (or an
 * exception filter) translate these to HTTP responses so that adapters stay
 * free of `@nestjs/common` imports and can be reused by non-HTTP callers
 * (queue workers, CLI tools, alternate transports).
 */

export class ProgramNotFoundError extends Error {
  constructor(public readonly program: string) {
    super(`Program '${program}' not found`);
    this.name = 'ProgramNotFoundError';
  }
}

export class WorkoutNotFoundError extends Error {
  constructor(
    public readonly program: string,
    public readonly cycleNum: number,
    public readonly workoutNum: number,
  ) {
    super(
      `Workout ${workoutNum} for program '${program}' cycle ${cycleNum} not found`,
    );
    this.name = 'WorkoutNotFoundError';
  }
}

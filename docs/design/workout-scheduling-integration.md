# Workout Scheduling Integration Design

**Status:** Design (not yet implemented)  
**Last Updated:** May 16, 2026  
**Scope:** Program editing with per-program workouts/week override and automatic workout date distribution

## Overview

This design document specifies how to integrate the workout scheduling feature into Lifting Logbook. The feature allows users to:

1. Define a preferred workout schedule (fixed days or rotating pattern) in settings
2. Override the prescribed workouts-per-week for any program independently
3. Automatically distribute cycle workouts across actual calendar dates respecting the user's schedule

## Data Model

### User Settings Extension

Add to the user settings document/record:

```typescript
// packages/types/src/api.ts

export interface UserWorkoutSchedule {
  type: 'fixed' | 'rotating';
  /** For fixed schedules: array of day indices (0=Mon, 6=Sun) */
  days?: number[];
  /** For rotating schedules: array of week patterns, each containing day indices */
  weeks?: number[][];
}

export interface UserSettingsResponse {
  activeProgram: string | null;
  workoutSchedule?: UserWorkoutSchedule;
}
```

### Program Override Model

Extend `UpdateCycleOverrides` to support per-program override:

```typescript
// packages/types/src/api.ts

export interface UpdateCycleOverrides {
  targetWeekday?: string;
  today?: Date;
  overrideDate?: Date;
  updateStartWeekday?: boolean;
  // NEW: per-program workout frequency override
  workoutsPerWeekOverride?: number | null;
}

// When creating/updating a custom program:
export interface CustomProgramResponse {
  id: string;
  name: string;
  description: string | null;
  baseTemplate: string | null;
  createdAt: string;
  specs: CustomProgramSpecRow[];
  // NEW: override workouts/week (null = use prescribed)
  workoutsPerWeekOverride?: number | null;
}

export interface UpdateCustomProgramRequest {
  name?: string;
  description?: string;
  specs?: CustomProgramSpecRow[];
  workoutsPerWeekOverride?: number | null;
}
```

## API Contracts

### GET /users/settings

**Response:**
```json
{
  "activeProgram": "5-3-1-custom",
  "workoutSchedule": {
    "type": "fixed",
    "days": [0, 2, 4]
  }
}
```

### PATCH /users/settings

**Request:**
```json
{
  "workoutSchedule": {
    "type": "rotating",
    "weeks": [
      [0, 2, 4, 5],
      [1, 3, 5]
    ]
  }
}
```

### GET /programs/:program

**Response (custom program):**
```json
{
  "id": "5-3-1-custom",
  "name": "5/3/1 (Custom)",
  "description": null,
  "baseTemplate": "5-3-1",
  "createdAt": "2026-05-10T14:23:00Z",
  "workoutsPerWeekOverride": 3,
  "specs": [
    {
      "week": 1,
      "offset": 0,
      "lift": "Squat",
      "increment": 5,
      "order": 1,
      "sets": 3,
      "reps": 5,
      "amrap": false,
      "warmUpPct": "40%, 50%, 60%",
      "wtDecrementPct": 10,
      "activation": "leg press"
    }
    // ... more specs
  ]
}
```

### PATCH /programs/:program

**Request:**
```json
{
  "workoutsPerWeekOverride": 3
}
```

## Core Service Logic

### Workout Distribution Algorithm

**Purpose:** Given N workouts in a cycle, M workouts/week, and a user schedule pattern, produce a list of dates for each workout.

**Location:** `packages/core/src/services/workout/distributeWorkouts.ts` (new file)

**Pseudo-code:**

```typescript
function distributeWorkouts(
  cycleWorkouts: number,           // 12
  effectiveWorkoutsPerWeek: number, // 3 (after override applied)
  userSchedule: UserWorkoutSchedule, // { type: 'fixed', days: [0, 2, 4] }
  cycleStartDate: Date              // May 19, 2026 (Monday)
): { week: number; workouts: Date[] }[] {
  const distribution = [];
  let workoutsPlaced = 0;
  let weekCounter = 0;
  let currentWeekStart = alignToMonday(cycleStartDate);

  while (workoutsPlaced < cycleWorkouts) {
    const weekPattern = getWeekPattern(userSchedule, weekCounter);
    const weekWorkouts: Date[] = [];

    for (const dayIndex of weekPattern) {
      if (workoutsPlaced >= cycleWorkouts) break;

      const workoutDate = addDaysToDate(currentWeekStart, dayIndex);
      weekWorkouts.push(workoutDate);
      workoutsPlaced++;
    }

    if (weekWorkouts.length > 0) {
      distribution.push({
        week: weekCounter + 1,
        workouts: weekWorkouts
      });
    }

    currentWeekStart = addDaysToDate(currentWeekStart, 7);
    weekCounter++;
  }

  return distribution;
}

function getWeekPattern(
  schedule: UserWorkoutSchedule,
  weekIndex: number
): number[] {
  if (schedule.type === 'fixed') {
    return schedule.days || [];
  } else {
    // Rotating: select week pattern cyclically
    const weekIndex = weekIndex % schedule.weeks!.length;
    return schedule.weeks![weekIndex];
  }
}
```

**Returns:** Array of week objects, each containing the dates of that week's workouts.

### Lift Date Scheduling

**Purpose:** When a cycle is created or updated, schedule each lift's dates based on its offset and the workout distribution.

**Location:** Extend `packages/core/src/services/workout/updateLiftDates.ts`

**Changes:**
- Current function updates lift dates when user manually edits one
- New function: `scheduleLiftDates()` — applies the distribution algorithm to all lifts in a cycle spec
- Accepts: cycle number, program spec, user schedule, effective workouts/week
- Produces: lift date assignments for each lift based on its offset

**Algorithm:**
```
For each lift in the cycle spec:
  1. Find all lifts with the same offset (they belong to the same "day")
  2. Get the offset-th workout date from the distribution
  3. Assign that date to all lifts in the offset group
```

### Effective Workouts/Week Calculation

**Location:** `packages/core/src/services/workout/calculateEffectiveWorkoutsPerWeek.ts` (new)

**Logic:**
```typescript
function calculateEffectiveWorkoutsPerWeek(
  program: CustomProgramResponse,
  userOverride?: number | null
): number {
  // If program has an explicit override, use it
  if (program.workoutsPerWeekOverride !== null && program.workoutsPerWeekOverride !== undefined) {
    return program.workoutsPerWeekOverride;
  }

  // Otherwise, infer from program spec:
  // For 5/3/1-style programs, count unique offsets in the first week
  // For general programs, count rows where week === 1
  
  const firstWeekSpecs = program.specs.filter(s => s.week === 1);
  return firstWeekSpecs.length;
}
```

## Integration Points

### 1. Custom Program Creation/Update

**File:** `packages/core/src/services/workout/` (service or controller layer)

When a custom program is created or its specs are updated:
1. If `workoutsPerWeekOverride` is set, validate it's > 0
2. Store the override with the program
3. Trigger cycle recalculation if a cycle is active

### 2. Cycle Dashboard Generation

**File:** `packages/core/src/services/dashboard/` (extend existing)

When generating a cycle dashboard:
1. Load user's `workoutSchedule` from settings
2. Load the program's `workoutsPerWeekOverride` (if any)
3. Calculate effective workouts/week
4. Call `distributeWorkouts()` to get workout dates
5. Store workout dates in the cycle or cycle weeks

### 3. Lift Record Creation

**File:** `packages/core/src/services/workout/extractLiftRecords.ts`

Existing logic extracts lift records from user input. When a user logs a set:
1. If no explicit date provided, use the scheduled date from `distributeWorkouts()`
2. Allow user to override the scheduled date (manual reschedule)

### 4. Settings API

**File:** `apps/api/src/controllers/` or `apps/api/src/routes/`

Add endpoints:
- `GET /users/settings` — return `workoutSchedule`
- `PATCH /users/settings` — update `workoutSchedule`

### 5. Program API

**File:** `apps/api/src/controllers/programs.ts`

Extend program endpoints:
- `GET /programs/:program` — include `workoutsPerWeekOverride` in response
- `PATCH /programs/:program` — accept `workoutsPerWeekOverride` in request
- `POST /programs` — accept `workoutsPerWeekOverride` in request

## Type Dependencies

### In `packages/types/src/api.ts`:
- Add `UserWorkoutSchedule` interface
- Extend `UserSettingsResponse` with `workoutSchedule`
- Extend `UpdateCycleOverrides` with `workoutsPerWeekOverride`
- Extend `CustomProgramResponse` with `workoutsPerWeekOverride`
- Extend `UpdateCustomProgramRequest` with `workoutsPerWeekOverride`
- (Optional) Add new `WorkoutDistributionResponse` if exposing distribution via API

### In `packages/core/src/models/`:
- Optionally create model classes for distribution results if the service layer needs them

## Testing Strategy

### Unit Tests

**`packages/core/tests/services/workout/distributeWorkouts.test.ts`:**
- Fixed schedule: 12 workouts, 3/week, Mon-Wed-Fri → validates 4 weeks, correct day indices
- Rotating schedule: 12 workouts, alternating 4/3 per week → validates distribution respects pattern
- Edge cases: 1 workout, 10 workouts/week (capping), schedule with no days selected

**`packages/core/tests/services/workout/calculateEffectiveWorkoutsPerWeek.test.ts`:**
- Program with override: returns override value
- Program without override: calculates from spec (first week count or offset count)
- Edge cases: empty spec, malformed override

### Integration Tests

**`apps/api/tests/programs.test.ts`:**
- PATCH program with `workoutsPerWeekOverride` → persists and returns in GET
- GET cycle dashboard → includes workout dates distributed per user schedule
- Create lift records at distributed dates

**`apps/api/tests/users.test.ts`:**
- PATCH settings with `workoutSchedule` → persists
- GET settings → returns schedule with correct structure

### E2E Tests (Playwright, once #259 is implemented)

- User sets workout schedule to Mon-Wed-Fri
- User creates a program with 12 workouts, override to 3/week
- System calculates 4 weeks and distributes workouts
- User views cycle dashboard → sees workouts on correct days
- User logs a set → defaults to scheduled date, can override

## Migration & Backwards Compatibility

- Existing programs without `workoutsPerWeekOverride` default to `null` (use prescribed)
- Existing users without `workoutSchedule` default to `null` (no override applied)
- When `workoutSchedule` is `null`, system should not error; use a sensible default (e.g., Mon-Wed-Fri) or require user to set it on first use

## Open Questions

1. **UI for rotating schedules:** Should the rotation start on a specific date, or always be "week A, week B, week A, week B..."?
2. **Partial week handling:** If a cycle ends mid-week, do we distribute remaining workouts across partial week, or start fresh next week?
3. **Holiday/deload handling:** Should users be able to mark weeks as deloads, pushing remaining workouts forward?
4. **Workout-to-lift mapping:** Is offset the only way to know which lifts belong together, or do we need an explicit "lift group"?

## References

- Current implementation: `packages/core/src/services/workout/updateLiftDates.ts` (shows offset-based grouping)
- Type definitions: `packages/types/src/api.ts` and `packages/types/src/domain.ts`
- Cycle model: `packages/core/src/models/CycleDashboard.ts`
- Program spec: `packages/core/src/models/LiftingProgramSpec.ts`

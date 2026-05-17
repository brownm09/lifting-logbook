# Workout Scheduling Integration Design

**Status:** Design (not yet implemented)  
**Last Updated:** May 17, 2026  
**Scope:** Program editing with per-program workouts/week override and automatic workout date distribution

## Overview

This design document specifies how to integrate the workout scheduling feature into Lifting Logbook. The feature allows users to:

1. Define a preferred workout schedule (fixed days or rotating pattern) in settings
2. Override the prescribed workouts-per-week for any program independently
3. Automatically distribute cycle workouts across actual calendar dates respecting the user's schedule

### No-Schedule Mode

When no `workoutSchedule` is set in user settings, the system operates in **no-schedule mode**:
- No dates are assigned to pending/planned workouts
- The effective date of a workout is set to the date the user logs their first set for that workout
- This is the default state for new users and the fallback when a user explicitly declines to apply their schedule to a program

### Schedule Incompatibility

An incompatibility exists when the user's schedule day count does not match a program's prescribed workouts-per-week (e.g., a Mon-Wed-Fri schedule with a 4-day/week program). When incompatibility is detected — either when the user sets a new schedule while a program is active, or when the user selects a program that conflicts with their current schedule — the system prompts the user to choose:

1. **Override the program** — run the program at the schedule's effective workouts/week and recalculate all pending workout dates. The override value is stored on the program (`workoutsPerWeekOverride`).
2. **No-schedule mode for this program** — treat the active program as if no schedule is set: no pending dates, date set at logging time. The program's `workoutsPerWeekOverride` is set to `null`.

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

The override is stored at the **program level**, not per-cycle. `UpdateCycleOverrides` is not extended. When creating or updating a custom program:

```typescript
// packages/types/src/api.ts

// When creating/updating a custom program:
export interface CustomProgramResponse {
  id: string;
  name: string;
  description: string | null;
  baseTemplate: string | null;
  createdAt: string;
  specs: CustomProgramSpecRow[];
  // null = use prescribed; set when user accepts incompatibility override
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
    const patternIndex = weekIndex % schedule.weeks!.length;
    return schedule.weeks![patternIndex];
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

Returns `null` when no schedule is set, signalling no-schedule mode to the caller.

**Logic:**
```typescript
function calculateEffectiveWorkoutsPerWeek(
  program: CustomProgramResponse,
  userSchedule: UserWorkoutSchedule | null
): number | null {
  // No schedule → no-schedule mode; dates are set at logging time, not pre-assigned
  if (!userSchedule) return null;

  // User accepted an incompatibility override for this program — use the stored value
  if (program.workoutsPerWeekOverride !== null && program.workoutsPerWeekOverride !== undefined) {
    return program.workoutsPerWeekOverride;
  }

  // Compatible: infer prescribed frequency from program spec
  // Count unique offsets in the first week's specs
  const firstWeekSpecs = program.specs.filter(s => s.week === 1);
  return firstWeekSpecs.length;
}

/** Returns how many workouts per week the user's schedule supports. */
function getScheduleWorkoutsPerWeek(schedule: UserWorkoutSchedule): number {
  if (schedule.type === 'fixed') {
    return (schedule.days || []).length;
  } else {
    // Rotating: use the maximum week length to avoid under-scheduling
    return Math.max(...(schedule.weeks || [[]]).map(w => w.length));
  }
}
```

## Integration Points

### 1. Custom Program Creation/Update

**File:** `packages/core/src/services/workout/` (service or controller layer)

When a custom program is created or its specs are updated:
1. If `workoutsPerWeekOverride` is set, validate it's > 0
2. Store the override with the program
3. Trigger pending-date recalculation if a cycle is active and a schedule is set

### 2. Schedule Compatibility Check

**File:** `packages/core/src/services/workout/` (new helper, called from settings and program selection flows)

Fires in two situations:
- User sets or updates their `workoutSchedule` while a program is active
- User selects a program whose prescribed workouts/week differs from the current schedule's day count

**Logic:**
```
schedulePerWeek = getScheduleWorkoutsPerWeek(userSchedule)
prescribedPerWeek = inferPrescribedFromSpec(program)

if schedulePerWeek !== prescribedPerWeek:
  prompt user:
    Option A — "Run at my schedule pace (N days/week)"
      → set program.workoutsPerWeekOverride = schedulePerWeek
      → recalculate pending workout dates via distributeWorkouts()
    Option B — "No scheduled dates for this program"
      → set program.workoutsPerWeekOverride = null
      → clear any pending dates; date set at logging time
```

If there is no active program when the schedule is set, no prompt is shown; the schedule is saved and will be applied when the next program is selected.

### 3. Cycle Dashboard Generation

**File:** `packages/core/src/services/dashboard/` (extend existing)

When generating a cycle dashboard:
1. Load user's `workoutSchedule` from settings
2. Call `calculateEffectiveWorkoutsPerWeek(program, userSchedule)`
3. If result is `null` (no-schedule mode) → return cycle data with no pending workout dates
4. Otherwise call `distributeWorkouts()` with the effective frequency and store dates in the cycle

### 4. Lift Record Creation

**File:** `packages/core/src/services/workout/extractLiftRecords.ts`

When a user logs a set:
1. If the workout has a pre-assigned scheduled date (schedule mode), default to that date
2. If the workout has no scheduled date (no-schedule mode), use today's date as the effective workout date
3. Allow the user to override the date in either case (manual reschedule)

### 5. Settings API

**File:** `apps/api/src/controllers/` or `apps/api/src/routes/`

Add endpoints:
- `GET /users/settings` — return `workoutSchedule`
- `PATCH /users/settings` — update `workoutSchedule`

### 6. Program API

**File:** `apps/api/src/controllers/programs.ts`

Extend program endpoints:
- `GET /programs/:program` — include `workoutsPerWeekOverride` in response
- `PATCH /programs/:program` — accept `workoutsPerWeekOverride` in request
- `POST /programs` — accept `workoutsPerWeekOverride` in request

## Type Dependencies

### In `packages/types/src/api.ts`:
- Add `UserWorkoutSchedule` interface
- Extend `UserSettingsResponse` with `workoutSchedule`
- Extend `CustomProgramResponse` with `workoutsPerWeekOverride`
- Extend `UpdateCustomProgramRequest` with `workoutsPerWeekOverride`
- `UpdateCycleOverrides` is **not** extended — the override is program-scoped, not cycle-scoped
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
- No schedule → returns `null` (no-schedule mode)
- Schedule set, program has override → returns override value
- Schedule set, no override → calculates from spec (first week count or offset count)
- Edge cases: empty spec, schedule with no days

### Integration Tests

**`apps/api/tests/programs.test.ts`:**
- PATCH program with `workoutsPerWeekOverride` → persists and returns in GET
- GET cycle dashboard, no schedule set → no pending dates returned
- GET cycle dashboard, schedule set and compatible → workout dates distributed
- GET cycle dashboard, incompatibility accepted → dates distributed at override frequency
- Create lift records with no scheduled date → date defaults to today

**`apps/api/tests/users.test.ts`:**
- PATCH settings with `workoutSchedule` → persists
- GET settings → returns schedule with correct structure
- Setting schedule while incompatible program active → API surfaces incompatibility flag

### E2E Tests (Playwright, once #259 is implemented)

- No schedule set: user logs a set → workout date = today (no pre-assigned date shown)
- User sets Mon-Wed-Fri schedule; program prescribes 3/week → compatible, dates distributed
- User sets Mon-Wed-Fri schedule; program prescribes 4/week → incompatibility prompt shown
  - User chooses override → cycle dashboard shows 3 workouts/week on correct days
  - User chooses no-schedule → cycle dashboard shows no pending dates
- User changes schedule while cycle active → incompatibility prompt fires again if needed

## Migration & Backwards Compatibility

- Existing users without `workoutSchedule` default to `null` → no-schedule mode; no pending dates; no behavior change from current system
- Existing programs without `workoutsPerWeekOverride` default to `null` → prescribed frequency used when a schedule is later set
- No data migration required: the new columns are nullable and the no-schedule fallback is the correct default for all existing data

## Open Questions

1. **UI for rotating schedules:** Should the rotation start on a specific date, or always be "week A, week B, week A, week B..."?
2. **Partial week handling:** `distributeWorkouts()` stops placing workouts once N are placed — if the last week is partial, remaining days in that week are unused. Is this the correct behavior, or should the system always fill out the final week?
3. **Holiday/deload handling:** Out of scope for MVP. Deferred to future enhancement.
4. **Workout-to-lift mapping:** Is offset the only way to know which lifts belong together, or do we need an explicit "lift group"?
5. **Incompatibility prompt placement:** Should the prompt appear in the Settings flow (when schedule is saved) or in the Program selection flow (when a program is picked), or both? Which should take precedence when both trigger simultaneously?

## References

- Current implementation: `packages/core/src/services/workout/updateLiftDates.ts` (shows offset-based grouping)
- Type definitions: `packages/types/src/api.ts` and `packages/types/src/domain.ts`
- Cycle model: `packages/core/src/models/CycleDashboard.ts`
- Program spec: `packages/core/src/models/LiftingProgramSpec.ts`

# Workout Scheduling Override — Implementation Roadmap

**Status:** `shipped`
**Linked Design:** [`docs/design/workout-scheduling-integration.md`](../design/workout-scheduling-integration.md)  
**Linked Prototype:** [`docs/mockups/workout-scheduling.html`](../mockups/workout-scheduling.html)  
**Epic:** Client Applications  
**Milestone:** v0.3 — Client Applications

## Problem Statement

Currently, users cannot define a preferred workout schedule (e.g., Mon-Wed-Fri) and have the system automatically distribute upcoming workout dates to match it. A 5/3/1 program with 12 workouts runs at whatever pace the user trains — the system should place those workouts on the user's chosen days and show them in the cycle dashboard.

**Example:**
- Program spec: 12 workouts
- User's schedule: Mon-Wed-Fri
- Expected outcome: 4 weeks to complete the cycle, workouts on Mon/Wed/Fri

The pace follows naturally from the schedule — no separate "workouts per week" override is needed.

## Success Criteria

- [ ] User can define preferred workout days (fixed or rotating pattern) in Settings
- [ ] When a schedule is set and a program is active, user is prompted to enable schedule mode
- [ ] System distributes workout dates respecting the user's schedule
- [ ] Rotating schedules (e.g., A/B weeks) are supported
- [ ] Existing programs without a schedule continue to work (no-schedule mode — backward compatible)
- [ ] Cycle dashboard shows workout dates on the correct days

## Phases

### Phase 1: Settings UI & Data Model (1 week)

**Acceptance Criteria:**
- [ ] User can access Settings and set preferred workout days
- [ ] Settings support both fixed (Mon-Wed-Fri) and rotating (A/B weeks) patterns
- [ ] Settings are persisted to database and retrieved on app load
- [ ] API exposes `GET /users/settings` with `workoutSchedule` field
- [ ] API exposes `PATCH /users/settings` to update schedule
- [ ] No errors on app startup for users without a schedule set

**Tasks:**
1. Add `UserWorkoutSchedule` interface to `packages/types/src/api.ts`
2. Extend `UserSettingsResponse` with `workoutSchedule` field
3. Create/update user settings database schema to store schedule
4. Implement `GET /users/settings` endpoint in `apps/api`
5. Implement `PATCH /users/settings` endpoint in `apps/api`
6. Build Settings UI in `apps/web` with day selector (leverage prototype)
7. Wire Settings UI to API, add error handling
8. Write unit tests for API endpoints
9. Write E2E test: set schedule, refresh page, verify persistence

**Owned by:** Backend (API + schema), Frontend (Settings UI)

---

### Phase 2: Distribution Core Logic (1 week)

**Acceptance Criteria:**
- [ ] `distributeWorkouts()` algorithm correctly distributes N workouts across schedule days
- [ ] `distributeWorkouts()` respects user's workout schedule (fixed or rotating)
- [ ] Schedule-mode prompt is surfaced by the API when a schedule is set and a program is active
- [ ] Unit tests validate distribution logic (fixed schedule, rotating schedule, edge cases)

**Tasks:**
1. Implement `distributeWorkouts()` in `packages/core/src/services/workout/`
2. Implement `getScheduleWorkoutsPerWeek()` display helper (duration estimate)
3. Write unit tests for distribution algorithm (fixed, rotating, edge cases)
4. Add schedule-mode flag to settings or program-activation response (for UI to trigger prompt)
5. Write integration test: set schedule + activate program, verify schedule-mode flag returned

**Owned by:** Backend (Core + API)

---

### Phase 3: Cycle Dashboard Integration (1 week)

**Acceptance Criteria:**
- [ ] When a cycle is created, system distributes workout dates per user schedule
- [ ] Cycle dashboard includes workout dates in `CycleWeekSummary` or similar structure
- [ ] Dates respect user's schedule and program override
- [ ] System gracefully handles users without a schedule set (uses default or error)
- [ ] Existing cycles continue to work (no regression)
- [ ] E2E test: create cycle, verify dates are correct

**Tasks:**
1. Extend `CycleDashboardResponse` to include workout dates (or create new field)
2. Modify cycle creation logic to call `distributeWorkouts()`
3. Store workout dates in database (cycle_workouts table or similar)
4. Modify `GET /programs/:program/cycles/:cycleNum` to return dates
5. Write integration test: create cycle with override + schedule, verify dates
6. Write E2E test: create cycle in UI, view calendar, verify dates

**Owned by:** Backend (Services + API)

---

### Phase 4: Lift Record Scheduling (1 week)

**Acceptance Criteria:**
- [ ] When user logs a lift, system suggests the scheduled date
- [ ] User can override the suggested date
- [ ] Lift records respect the scheduled dates from distribution
- [ ] Existing lift records continue to work (no regression)
- [ ] E2E test: log a lift, verify it defaults to scheduled date

**Tasks:**
1. Modify lift record creation to fetch scheduled date from distribution
2. Update `CreateLiftRecordRequest` to accept optional `scheduledDate` (for suggestions)
3. Modify UI to show scheduled date when logging a set
4. Allow user to override scheduled date in UI
5. Write integration test: create lift record, verify date
6. Write E2E test: log lift, verify date suggestion, override it

**Owned by:** Backend (Services + API), Frontend (Lift logging UI)

---

### Phase 5: Program Editor UI (1 week)

**Acceptance Criteria:**
- [ ] User can edit a custom program and set `workoutsPerWeekOverride`
- [ ] UI shows effective workouts/week and estimated cycle duration
- [ ] UI shows calendar preview of workout distribution
- [ ] User can toggle between prescribed and override
- [ ] Changes are persisted to API
- [ ] E2E test: edit program, set override, verify calendar updates

**Tasks:**
1. Build Program Editor UI (leverage prototype)
2. Wire override input to `PATCH /programs/:program` API
3. Add calendar preview showing workout distribution
4. Add info boxes explaining the math (how many weeks, when it ends)
5. Write E2E test: create program, set override, verify calendar
6. Write E2E test: edit program, change override, verify dates update

**Owned by:** Frontend

---

## Estimated Effort

| Phase | Backend | Frontend | Duration |
|-------|---------|----------|----------|
| 1: Settings | 3d | 2d | 1 week |
| 2: Override Logic | 3d | — | 1 week |
| 3: Cycle Dashboard | 2d | 1d | 1 week |
| 4: Lift Scheduling | 2d | 2d | 1 week |
| 5: Program Editor UI | — | 3d | 1 week |
| **Total** | **10d** | **8d** | **5 weeks** |

## Dependencies & Blockers

- **Phase 1 blocks:** Phase 3, 4, 5 (need user schedule to calculate dates)
- **Phase 2 blocks:** Phase 3, 5 (need override + algorithm for distribution)
- **Phase 3 blocks:** Phase 4 (need cycle with dates to schedule lifts)
- **No external blockers** identified; all work is contained in Lifting Logbook codebase

## Rollout Strategy

1. Deploy Phase 1 + 2 together (Settings + Core Logic)
   - Users can set schedule, programs can store override
   - No visible changes to workflow yet
2. Deploy Phase 3 (Cycle Dashboard)
   - Existing cycles still work; new cycles use distributed dates
   - Users see dates in dashboard (but UI may not show them yet)
3. Deploy Phase 4 + 5 together (Lift Logging + Program Editor)
   - Users can now interact with the feature end-to-end
   - Settings → Program Editor → Cycle Dashboard → Lift Logging

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Distribution algorithm has off-by-one errors | Medium | Medium | Unit tests with edge cases; manual QA with rotating schedules |
| Users with no schedule set → crashes | Medium | High | Default behavior: return error or use fallback schedule; test explicitly |
| Existing cycles/lifts break | Low | Critical | Keep backward compatibility; migration tests for legacy data |
| Rotating schedule logic is confusing | Medium | Medium | Clear docs + UI tooltips; limit to 2–3 week patterns in MVP |
| Partial week handling edge cases | Low | Medium | Document behavior; defer complex cases (holidays) to Phase 2 |

## Future Enhancements (Out of Scope)

- Holiday/deload weeks that automatically skip or push workouts forward
- Auto-reschedule on missed workouts (e.g., "I missed Wed, move remaining to next week")
- Integration with calendar APIs (Google Calendar, Outlook)
- Workout notifications based on scheduled dates
- Seasonal periodization (different schedules at different times of year)
- Coach-managed programs with collaborative scheduling

## Testing Checklist

### Unit Tests
- [ ] `distributeWorkouts()` with fixed schedule
- [ ] `distributeWorkouts()` with rotating schedule (2-week pattern)
- [ ] `distributeWorkouts()` with 1 workout
- [ ] `distributeWorkouts()` with 0 days in schedule (edge case)
- [ ] `getScheduleWorkoutsPerWeek()` with fixed schedule
- [ ] `getScheduleWorkoutsPerWeek()` with rotating schedule (average of week lengths)

### Integration Tests
- [ ] Create user with schedule, retrieve via API
- [ ] Update schedule, verify in GET response
- [ ] Set schedule while program active → API returns schedule-mode prompt flag
- [ ] Enable schedule mode → create cycle, verify dates distributed correctly
- [ ] Log lift record at scheduled date
- [ ] Create cycle with no user schedule → no pending dates (no-schedule mode)

### E2E Tests
- [ ] Settings: set Mon-Wed-Fri, refresh, verify persisted
- [ ] Settings: switch to rotating (A/B), refresh, verify persisted
- [ ] Settings: set schedule while program active → schedule-mode prompt shown
- [ ] Schedule mode: enable → cycle dashboard shows dates on Mon/Wed/Fri
- [ ] Schedule mode: decline → cycle dashboard shows no pending dates
- [ ] Cycle Dashboard: view dates on calendar, all on correct days
- [ ] Lift Logging: log set, verify default date is scheduled date

## References

- **Design Doc:** `docs/design/workout-scheduling-integration.md`
- **Prototype:** `docs/mockups/workout-scheduling.html`
- **Related Types:** `packages/types/src/api.ts`, `packages/types/src/domain.ts`
- **Related Services:** `packages/core/src/services/workout/updateLiftDates.ts`
- **Related Models:** `packages/core/src/models/CycleDashboard.ts`, `packages/core/src/models/LiftingProgramSpec.ts`

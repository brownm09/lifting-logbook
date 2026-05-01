# ADR-012: Analytics and A/B Testing — Firebase Analytics and Optimizely

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass with gaps — open items: [#41](https://github.com/brownm09/lifting-logbook/issues/41)

---

## Context

The application conducts two instrumented comparisons:

1. **React Native vs. Native Kotlin** ([ADR-008](ADR-008-mobile-strategy.md)): Client technology A/B test
2. **GKE Autopilot vs. Cloud Run** ([ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)): Infrastructure A/B test

For the client comparison to produce valid results, both clients must emit identical, comparable
telemetry. This requires a shared event taxonomy, consistent instrumentation, and analytics
tooling that supports both React Native and native Android SDKs.

For the infrastructure comparison, server-side metrics from Cloud Monitoring are sufficient
([ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)). This ADR focuses on client-side analytics.

---

## Decision

Use **Firebase Analytics** for behavioral analytics and **Optimizely Feature Experimentation**
for controlled A/B experiments. Define a **shared event taxonomy** in `packages/types` and
import it in both mobile clients.

### SDK Availability

| Tool | React Native | Native Kotlin (Android) |
|---|---|---|
| Firebase Analytics | `@react-native-firebase/analytics` | `com.google.firebase:firebase-analytics` |
| Firebase Crashlytics | `@react-native-firebase/crashlytics` | `com.google.firebase:firebase-crashlytics` |
| Firebase Performance | `@react-native-firebase/perf` | `com.google.firebase:firebase-perf` |
| Optimizely | `@optimizely/react-sdk` | `com.optimizely.sdk:android-sdk` |

Both SDKs for each tool are fully supported and actively maintained.

### Shared Event Taxonomy

Defined in `packages/types/src/analytics.ts` and imported by both clients:

```typescript
// packages/types/src/analytics.ts

export const AnalyticsEvent = {
  // Workout logging
  WORKOUT_STARTED:        'workout_started',
  WORKOUT_COMPLETED:      'workout_completed',
  WORKOUT_ABANDONED:      'workout_abandoned',
  SET_LOGGED:             'set_logged',

  // Navigation
  SCREEN_VIEWED:          'screen_viewed',

  // Training maxes
  TRAINING_MAXES_UPDATED: 'training_maxes_updated',

  // Cycle management
  CYCLE_STARTED:          'cycle_started',
  CYCLE_DASHBOARD_VIEWED: 'cycle_dashboard_viewed',
} as const;

export type AnalyticsEventName = typeof AnalyticsEvent[keyof typeof AnalyticsEvent];

// Event properties — each event name maps to its expected property shape
export interface EventProperties {
  workout_started:        { lift: string; week: number; cycle: number; client: ClientType };
  workout_completed:      { lift: string; week: number; cycle: number; duration_seconds: number; client: ClientType };
  workout_abandoned:      { lift: string; week: number; cycle: number; client: ClientType };
  set_logged:             { lift: string; reps: number; weight: number; unit: 'lbs' | 'kg'; client: ClientType };
  screen_viewed:          { screen_name: string; client: ClientType };
  training_maxes_updated: { lift_count: number; client: ClientType };
  cycle_started:          { cycle: number; client: ClientType };
  cycle_dashboard_viewed: { cycle: number; client: ClientType };
}

export type ClientType = 'react_native' | 'kotlin_compose' | 'web';
```

The `client` property on every event is what enables segmentation in Firebase Analytics to
compare React Native vs. Kotlin behavior.

### Optimizely Usage

Optimizely Feature Experimentation is used for controlled experiments where a specific feature
or UI variant is being tested, beyond the broad client-technology comparison. Example:

- **Experiment:** Single-screen workout logging vs. multi-step wizard
- **Metric:** `workout_completed` rate per `workout_started`
- **Split:** 50/50, applied independently within each client cohort

Both the React Native and Kotlin clients integrate with Optimizely's respective SDKs. The
experiment key, variation keys, and attribute names are also defined in `packages/types` to
ensure consistency.

---

## Rationale

**Why Firebase Analytics:**
- Native support for both React Native and Android (Kotlin) via official SDKs.
- Free tier is generous (no event volume cap for standard events).
- Integrates with Firebase Crashlytics and Performance Monitoring, providing a unified
  observability view per client.
- Since GCP is already the infrastructure platform ([ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)), Firebase (also GCP) fits the
  ecosystem without additional vendor relationships.

**Why Optimizely:**
- Optimizely Feature Experimentation (formerly Optimizely Full Stack) has both a React Native
  SDK and an Android SDK that operate client-side, without requiring backend changes to run
  experiments.
- Well-recognized in enterprise contexts — a meaningful portfolio signal for a director of
  engineering role.
- Supports the same experiment definition across multiple client types, enabling cross-client
  experiment analysis.

**Why a shared event taxonomy in `packages/types`:**
- Without a shared, imported taxonomy, event names drift between clients (e.g., React Native
  logs `'workoutCompleted'`, Kotlin logs `'workout_complete'`). The resulting data is
  un-segmentable and the comparison is invalid.
- TypeScript-enforced event names (the `AnalyticsEvent` const object) make typos a compile
  error in the React Native client. The Kotlin client references a separate but identical
  constant object generated from the shared type definitions (or maintained manually and
  validated in CI via a lint rule comparing the two).
- The `client: ClientType` property on every event is the primary segmentation dimension for
  the React Native vs. Kotlin comparison.

---

## Consequences

- Both mobile clients must import or replicate the event taxonomy. For the Kotlin client (which
  cannot import TypeScript packages), a companion `AnalyticsConstants.kt` file is maintained
  and validated against `packages/types/src/analytics.ts` in CI.
- Optimizely requires an account and project. The free Developer plan supports the experimentation
  needs of this application.
- Firebase Analytics data is available in the Firebase Console and can be exported to BigQuery
  for deeper analysis. BigQuery export is recommended for the A/B comparison documentation.

---

## CI Taxonomy Enforcement

To prevent silent drift between the TypeScript and Kotlin event taxonomy definitions, a CI
validation step runs on every pull request targeting `main`.

### How it works

The script `scripts/validate-analytics-taxonomy.mjs`:

1. Parses all string values from the `AnalyticsEvent` const object in
   `packages/types/src/analytics.ts`.
2. Checks that each event name string is present as a quoted literal in
   `apps/mobile-kotlin/app/src/main/java/com/liftinglogbook/analytics/AnalyticsConstants.kt`.
3. **If `AnalyticsConstants.kt` does not yet exist** (Kotlin app not yet scaffolded), the
   script exits successfully — this is not treated as drift.
4. **If `AnalyticsConstants.kt` exists but is missing one or more event names**, the script
   prints the missing events and exits with code 1, failing the CI job.

### Adding or renaming an event

When a new event is added to `AnalyticsEvent` in `packages/types/src/analytics.ts`:

1. Add the matching constant to `AnalyticsConstants.kt` in the same PR.
2. The CI step will fail if the Kotlin file is out of sync, preventing the PR from merging.

### CI configuration

The step is defined in `.github/workflows/ci.yml`:

```yaml
- name: Validate analytics taxonomy
  run: node scripts/validate-analytics-taxonomy.mjs
```

---

## Metrics for the React Native vs. Kotlin A/B Comparison

| Metric | Source | Segmented by `client` |
|---|---|---|
| Session length | Firebase Analytics | Yes |
| Screens per session | Firebase Analytics | Yes |
| `workout_completed` / `workout_started` ratio | Firebase Analytics | Yes |
| Crash-free session rate | Firebase Crashlytics | Yes |
| Screen render time (p50, p95) | Firebase Performance | Yes |
| App startup time | Firebase Performance | Yes |
| Install size | Play Console | N/A (separate APKs) |
| Experiment conversion rates | Optimizely | Yes |

Results and methodology are documented in `docs/mobile-ab-test-results.md`.

---

## Alternatives Considered

**Amplitude:** Excellent product analytics tool. More opinionated around funnel analysis.
Does not have as clean a native Android SDK story as Firebase. Ruled out in favor of Firebase's
ecosystem fit.

**Mixpanel:** Strong event analytics. Viable alternative to Firebase Analytics. Ruled out
because Firebase's integration with the broader GCP/Firebase ecosystem (Crashlytics, Performance,
Cloud Messaging) reduces the number of SDK dependencies.

**Custom analytics:** Logging events to the backend API and building analytics in BigQuery.
Maximum flexibility, zero vendor dependency. Significantly more engineering effort. Ruled out
for this project — the goal is demonstrated analytics integration, not a custom analytics stack.

---

## References

- [Firebase Analytics — Overview](https://firebase.google.com/docs/analytics) — Official Firebase Analytics documentation; covers event logging, user properties, and audience segmentation.
- [React Native Firebase — Analytics](https://rnfirebase.io/analytics/usage) — The `@react-native-firebase/analytics` SDK used in the React Native (Phase 1) client.
- [Firebase Analytics for Android](https://firebase.google.com/docs/analytics/get-started?platform=android) — The `com.google.firebase:firebase-analytics` SDK used in the Kotlin (Phase 2) client.
- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics) — The crash reporting SDK used in both clients; crash-free session rate is a primary A/B comparison metric.
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon) — The screen render time and app startup time SDK cited in the metrics table.
- [Optimizely Feature Experimentation — Welcome](https://docs.developers.optimizely.com/feature-experimentation/docs/welcome) — Official Optimizely Feature Experimentation docs; covers experiment configuration, variation assignment, and event tracking.
- [Optimizely — JavaScript (React) SDK](https://docs.developers.optimizely.com/feature-experimentation/docs/javascript-react-sdk) — The `@optimizely/react-sdk` used in the React Native client.
- [Optimizely — Android SDK](https://docs.developers.optimizely.com/feature-experimentation/docs/android-sdk) — The `com.optimizely.sdk:android-sdk` used in the Kotlin client.
- [Firebase — BigQuery Export](https://firebase.google.com/docs/projects/bigquery-export) — How Firebase Analytics data is streamed to BigQuery for deeper analysis; recommended in the Consequences section.

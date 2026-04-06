# ADR-008: Mobile Client Strategy — React Native to Native Kotlin with A/B Testing

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

A native Android application is a target platform. The choice of technology involves a tradeoff
between development speed (cross-platform frameworks), runtime performance (native), and the
ability to meaningfully compare the two approaches — which is an explicit portfolio goal.

---

## Decision

Build the mobile client in **two phases**, with an instrumented A/B comparison between them:

### Phase 1: React Native (Expo Managed Workflow)
- Shared TypeScript types from `packages/types` (same as web)
- Calls the same backend API (`apps/api`) as the web frontend
- Uses React Navigation for routing
- Uses Firebase Analytics and Optimizely SDKs (see [ADR-012](ADR-012-analytics-and-ab-testing.md)) for instrumentation
- Deployed to Android via Expo EAS Build

### Phase 2: Native Kotlin (Jetpack Compose)
- Full native Android app, built in Kotlin
- Calls the same backend API — API contract is unchanged
- Uses the Firebase Analytics Android SDK and Optimizely Android SDK (same event taxonomy
  as Phase 1 — see [ADR-012](ADR-012-analytics-and-ab-testing.md))
- Deployed to a separate Play Store internal track for A/B comparison

### A/B Testing Mechanism

Both apps are deployed simultaneously to different Play Store tracks:
- **Track A:** React Native build (production track or internal track)
- **Track B:** Kotlin/Compose build (internal track, promoted to production after validation)

Metrics compared (instrumented identically in both clients):
| Metric | Tool |
|---|---|
| Screen render time | Firebase Performance Monitoring |
| User engagement (session length, feature usage) | Firebase Analytics |
| Crash rate | Firebase Crashlytics |
| Feature experiment outcomes | Optimizely |
| Bundle size / install size | Play Console |

A/B test results and methodology are documented in `docs/mobile-ab-test-results.md` as findings
accumulate.

---

## Rationale

**React Native first:**
- Shared TypeScript types and API patterns with the web frontend reduce context switching.
- Expo Managed Workflow eliminates native build toolchain complexity during the initial phase.
- React Native is a widely-used cross-platform solution worth demonstrating. Many teams use it
  as a bridge while native capability is built.

**Native Kotlin second:**
- Jetpack Compose is the current standard for native Android UI development. It is performant,
  well-supported by Google, and increasingly expected for Android-focused roles.
- Native Kotlin provides a definitive performance baseline against which React Native can be
  measured.
- The migration pattern (RN → Kotlin, same backend) mirrors a real-world scenario many
  engineering teams have faced or are planning.

**Why keep the same API for both clients:**
- Ensures the A/B test measures *client technology*, not *backend differences*.
- Demonstrates that the backend API is a stable, platform-agnostic contract.

---

## Consequences

- Two mobile codebases must be maintained during the comparison period. This is accepted as a
  time-bounded investment for the portfolio goal.
- The event taxonomy defined in [ADR-012](ADR-012-analytics-and-ab-testing.md) is the critical dependency — if event names diverge
  between clients, the A/B comparison is invalid. The taxonomy must be defined in
  `packages/types` and imported by both clients.
- Play Store internal tracks are sufficient for distribution during the comparison period.
  Promoting the winning client to production is a Play Console configuration change.

---

## Alternatives Considered

**React Native only (no Kotlin phase):** Faster. Appropriate if native performance is not a
concern. Ruled out because the Kotlin comparison is an explicit portfolio and learning goal.

**Kotlin Multiplatform Mobile (KMM):** Shares business logic between Android and iOS in Kotlin.
Interesting technology but not yet mainstream. Ruled out — complexity exceeds the benefit at
this scale, and the iOS platform is not a current target.

**Flutter:** Cross-platform using Dart. Strong performance characteristics, but Dart is outside
the TypeScript/Kotlin stack being built. Ruled out on ecosystem consistency grounds.

**iOS:** Not currently a target platform. Could be added in a future phase using either React
Native (minimal additional work) or Swift/SwiftUI (a separate native implementation).

---

## References

- [React Native — Getting Started](https://reactnative.dev/docs/getting-started) — Official React Native documentation.
- [Expo — Documentation](https://docs.expo.dev) — The Expo managed workflow used in Phase 1; covers project structure, native modules, and OTA updates.
- [Expo EAS Build](https://docs.expo.dev/build/introduction/) — The cloud build service used to produce Android APKs without a local native toolchain.
- [React Navigation — Getting Started](https://reactnavigation.org/docs/getting-started) — The navigation library used in the React Native client.
- [Jetpack Compose — Documentation](https://developer.android.com/develop/ui/compose/documentation) — The native Android UI framework used in the Kotlin (Phase 2) client.
- [Kotlin — Documentation](https://kotlinlang.org/docs/home.html) — Official Kotlin language reference.
- [Google Play — Manage Tracks](https://support.google.com/googleplay/android-developer/answer/9844487) — How internal, closed testing, and production tracks work; the mechanism for deploying Phase 1 and Phase 2 builds simultaneously.

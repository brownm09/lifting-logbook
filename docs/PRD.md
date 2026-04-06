# Product Requirements Document — Lifting Logbook

**Status:** Draft
**Milestone scope:** Anchors v0.2 planning and beyond
**Owner:** brownm09

---

## Overview

Lifting Logbook is a personal strength training tracker. The v1.0 cloud-native version replaces
a Google Apps Script / Google Sheets implementation with a multi-user web and mobile product
built on modern cloud infrastructure.

This PRD is intentionally lightweight. It exists to make milestone trade-offs legible and
prevent scope creep — not to serve as a full product specification.

---

## User Personas

### 1. The Consistent Intermediate Lifter

**Who:** An individual who has been training for 1–5 years and follows a structured program
(e.g., Reverse Pyramid Training, 5/3/1 variants). Not a beginner, not an elite competitor.

**Context:** Trains 3–4 times per week. Tracks training maxes, cycle progression, and PR
history. Cares about week-over-week trends, not real-time biometrics.

**Why they'd use this:** The spreadsheet they've been maintaining is brittle. They want something
that handles progression math automatically, is accessible from their phone at the gym, and
doesn't require them to maintain formulas manually.

### 2. The Technical Evaluator

**Who:** An engineering leader, hiring committee member, or peer reviewer assessing this project
as a portfolio artifact.

**Context:** Reviews the repository structure, ADRs, infrastructure choices, and code quality
to assess architectural depth and engineering judgment.

**Why they'd engage:** To evaluate the author's fitness for a senior / staff / director-level
engineering role. The product must be credible enough that the technical decisions are
non-trivial — but the evaluator is not the primary end user.

---

## Jobs to Be Done

These are the outcomes the **Consistent Intermediate Lifter** is trying to achieve. The
Technical Evaluator's jobs are served by the ADR corpus and architecture, not the feature set.

| # | Job | Success looks like |
|---|-----|-------------------|
| J1 | Log a completed workout without friction | Workout recorded in under 2 minutes at the gym |
| J2 | Know what weight to use next session | Training max and target weights shown before each session |
| J3 | Track progress across a cycle | Dashboard showing lift trends over a training block |
| J4 | Recover from a missed cycle | Deload or reset applied automatically based on program rules |
| J5 | Access logs from phone and desktop interchangeably | Session data synced; no manual export required |

---

## Non-Goals

These are explicitly out of scope for v1.0. They may be revisited in future milestones.

- **Nutrition tracking** — caloric or macro logging is a separate product category
- **Social / community features** — sharing, leaderboards, following other lifters
- **Wearable / sensor integration** — heart rate, sleep, or recovery data from devices
- **Automated programming generation** — the app tracks programs; it does not prescribe them
  from scratch (users configure their program parameters; the app applies the math)
- **Video or form coaching** — no video upload, playback, or AI form analysis
- **Commercial SaaS** — billing, subscriptions, and self-serve signup are not v1.0 concerns;
  the initial deployment supports a known, small set of users

---

## Success Metrics

These metrics define what "v1.0 is working" means for the Consistent Intermediate Lifter.
Measurement methods are noted where non-obvious.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workout log completion rate | ≥ 90% of planned sessions logged within 24 hours | Session records vs. configured program schedule |
| Time-to-log a workout | ≤ 2 minutes median | Client-side timing, informally validated |
| Data loss incidents | 0 in any 30-day period | Error logs + manual review |
| Mobile availability | App loads and is usable offline for a queued workout | Manual test; offline-first is a v1.0 constraint |
| Progression accuracy | Training max applied correctly per program rules | Automated test coverage on `packages/core` logic |

---

## Relationship to Technical Goals

The non-functional goals from `docs/README.md` — demonstrating enterprise-grade patterns,
compliance awareness, and infrastructure portability — are portfolio goals, not user goals.
They inform *how* the product is built, not *what* it does. Feature decisions in v0.2+ should
be anchored to the jobs listed above, with architecture choices justified separately via ADRs.

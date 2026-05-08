# Proposal: On-Call Readiness — Runbooks, SLOs, and Incident Response

**Status:** `draft`
**Date:** 2026-05-08
**Issue:** [#201](https://github.com/brownm09/lifting-logbook/issues/201)

---

## Problem

There are no runbooks, SLOs, alerting rules, dashboards, or incident response docs. Helm
charts have liveness/readiness probes but no monitoring stack behind them. An engineer
paged at 3am has no playbook for "API throwing 500s" or "database connections exhausted"
— they would be reactive log-grepping with no escalation path. Without this, on-call
rotation cannot start safely regardless of how good the code is.

## Proposed Solution

Establish the on-call foundation in three parts:

1. **Runbooks** under `docs/runbooks/` — one Markdown file per known failure mode
   (API down, DB unreachable, Clerk auth outage, deploy regression rollback). Each runbook
   follows a fixed template: symptom → likely causes → diagnosis steps → remediation →
   escalation.
2. **SLOs and alert definitions** in `docs/operations/slo.md` — a small, conservative
   initial set (API availability 99.5%, p95 latency < 1s) with a documented error budget
   policy. Alert rules tied to these SLOs live alongside the observability stack work.
3. **Incident response guide** at `docs/operations/on-call.md` — severity levels, who to
   page, communication channels, postmortem template, and the link path from "alert fires"
   → "runbook" → "all clear."

This proposal sequences after the observability stack proposal because runbooks reference
dashboards and alerts that don't exist yet.

## Acceptance Criteria

- [ ] `docs/runbooks/` exists with a `README.md` index and runbooks for at least four scenarios: API 5xx surge, database unreachable, auth provider outage, deploy regression rollback
- [ ] `docs/operations/slo.md` defines availability and latency SLOs for `apps/api` with explicit measurement windows and error budget policy
- [ ] `docs/operations/on-call.md` defines severity levels (SEV1–SEV3), escalation paths, and postmortem template
- [ ] Each runbook follows the same template (symptom, likely causes, diagnosis, remediation, escalation)
- [ ] Alert rules from the observability stack proposal link to the corresponding runbook URL in their annotations
- [ ] An ADR captures the SLO methodology choice (e.g., burn-rate alerting vs. threshold alerting) with primary-source citations

## Out of Scope

- Multi-tier on-call rotation tooling (PagerDuty/Opsgenie integration) — defer until there is a real rotation
- Customer-facing status page — defer
- Chaos engineering / game days — defer
- Capacity planning runbooks — defer until traffic justifies them

## Open Questions

- Whether SLOs should be measured from the load balancer (true user experience) or from the application (excludes infra)
- Burn-rate vs threshold alerting — depends on what the observability backend supports natively

## References

- [Google SRE Workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/) — the SLO methodology this proposal follows
- [Google SRE Book — Being On-Call](https://sre.google/sre-book/being-on-call/) — the on-call structure and severity-level framing
- [Atlassian Incident Handbook](https://www.atlassian.com/incident-management/handbook) — reference for incident response process at small org scale

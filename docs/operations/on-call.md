# On-Call Guide

> **Joining the rotation?** Start with the [Observability & On-Call onboarding guide](observability-onboarding.md)
> for the full reading path (reading dashboards, logs, and traces) before this guide's incident process.

Covers severity levels, escalation paths, incident response process, and the postmortem
template. SLO targets and error budget policy are in [`docs/operations/slo.md`](slo.md).
Runbooks for specific failure modes are in [`docs/runbooks/`](../runbooks/README.md).

---

## Severity Levels

| Severity | Definition | Response target |
|---|---|---|
| **SEV1** | Full service outage, data loss risk, or security incident. No users can complete core workflows. | Acknowledge within 15 minutes. Sync call immediately. |
| **SEV2** | Partial degradation or confirmed SLO breach. A subset of users is affected or the error budget is burning faster than sustainable. | Acknowledge within 30 minutes. Async investigation; escalate to SEV1 if not improving. |
| **SEV3** | Minor degradation with no measurable user impact. Spurious alert, known false positive, or cosmetic issue. | Next business day. No paging. |

When in doubt, declare a higher severity and downgrade later — it is safer to over-respond than
to under-respond.

---

## Alert → Severity Mapping

| Alert | Default severity | Escalate to SEV1 if |
|---|---|---|
| `APIHighErrorRate` | SEV2 | Error rate sustained above 10% for > 5 minutes |
| `APIHighP95Latency` | SEV3 | Latency sustained above 3 s for > 15 minutes, or accompanied by `APIHighErrorRate` |
| `APINoRequests` | SEV3 | Known false-positive risk (see [ADR-018](../adr/ADR-018-observability-stack.md)); confirm in Grafana before acting |

A burn-rate alert (when implemented — see [ADR-019](../adr/ADR-019-slo-methodology.md)) at
the 14× rate maps to SEV1; at 6× to SEV2; at 3× to SEV3.

---

## Escalation Paths

### SEV1

1. Page the on-call engineer immediately.
2. If unacknowledged after 15 minutes, page the secondary on-call.
3. If unresolved after 30 minutes, loop in the engineering lead.
4. Open a real-time incident channel (e.g., `#incident-YYYY-MM-DD`).
5. Post a status update every 30 minutes until resolved.

### SEV2

1. Notify the on-call engineer via direct message.
2. Open an incident ticket and link the relevant alert.
3. If not improving after 60 minutes, escalate to SEV1.

### SEV3

1. Create a GitHub issue with the `bug` label.
2. Link the alert that fired and note why it was downgraded.
3. Assign to the next sprint.

---

## Incident Response Checklist

Work through this checklist in order. Skip steps that clearly do not apply.

- [ ] **Acknowledge the alert** in Grafana Alerting or silence it with a comment if it is a known false positive.
- [ ] **Assess severity** using the table above. Declare a severity level immediately — even if you are not sure yet, choose the higher one.
- [ ] **Open an incident channel** for SEV1/SEV2 (`#incident-YYYY-MM-DD`). Post the alert text and your initial assessment.
- [ ] **Check the dashboard.** Open Grafana → Lifting Logbook → API RED. Note the error rate, p95 latency, and request rate panels.
- [ ] **Identify the failure mode.** Use the runbook index at [`docs/runbooks/README.md`](../runbooks/README.md) to find the matching runbook.
- [ ] **Follow the runbook.** Work through symptom → diagnosis → remediation in order.
- [ ] **Communicate status.** Post an update to the incident channel every 30 minutes for SEV1, every 60 minutes for SEV2.
- [ ] **Resolve and verify.** Confirm the error rate drops and stays below the alert threshold for at least 10 minutes before declaring resolution.
- [ ] **Post-incident.** For SEV1 and SEV2, write a postmortem within 48 hours using the template below.

---

## Postmortem Template

Copy and fill in. Postmortems are blameless — focus on systemic causes, not individual errors.

```markdown
# Postmortem: <brief title>

**Date:** YYYY-MM-DD
**Severity:** SEV1 / SEV2
**Duration:** HH:MM (from first symptom to resolution)
**On-call:** <name>
**Reviewers:** <names>

---

## Timeline

| Time (UTC) | Event |
|---|---|
| HH:MM | Alert fired / first symptom observed |
| HH:MM | Incident declared; <name> acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Remediation applied |
| HH:MM | Service restored; alert resolved |

## Impact

- **Users affected:** <number or percentage>
- **Error budget consumed:** approximately X minutes out of Y.YY hours remaining in the current 28-day window
- **Customer-facing impact:** <description of what users experienced>

## Root Cause

<Explain the technical root cause in detail. What failed, why it failed, and why it was not caught earlier.>

## What Went Well

- <thing that worked>
- <thing that worked>

## What Could Be Improved

- <gap or failure>
- <gap or failure>

## Action Items

| Action | Owner | Due date |
|---|---|---|
| <specific remediation or prevention step> | <name> | YYYY-MM-DD |
| <runbook update or alert improvement> | <name> | YYYY-MM-DD |

## Lessons Learned

<One paragraph summarising what the team learned from this incident that applies broadly.>
```

---

## References

- [`docs/operations/slo.md`](slo.md) — SLO targets and error budget policy
- [`docs/runbooks/README.md`](../runbooks/README.md) — Runbook index
- [Google SRE Book — Being On-Call](https://sre.google/sre-book/being-on-call/) — on-call structure and severity framing
- [Atlassian Incident Handbook](https://www.atlassian.com/incident-management/handbook) — incident response at small org scale

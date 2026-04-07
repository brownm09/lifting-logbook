# ARB Review Checklist

**Architecture Review Board (ARB) — Lifting Logbook**

This checklist is applied to each Architecture Decision Record before the milestone that contains the decision is closed. Its purpose is to surface gaps, contradictions, and unresolved risks while the cost of change is still low.

---

## How to Use

1. Open the ADR under review.
2. Answer each question below. Mark each item **Pass**, **Gap**, or **N/A**.
3. For every **Gap**, either:
   - Amend the ADR inline to resolve it, or
   - File a follow-up GitHub issue and link it in the ADR's `## Open Items` section.
4. Record the review outcome in the ADR's header table under `Reviewed:`.

---

## Checklist

### 1. Problem Statement

| # | Question | Result |
|---|---|---|
| 1.1 | Is the problem statement scoped to a single decision? (Not "design the whole system") | |
| 1.2 | Does the context section explain *why this decision is needed now* rather than later? | |
| 1.3 | Are the constraints that shaped the decision explicit? (budget, team size, compliance, existing code) | |

### 2. Options Considered

| # | Question | Result |
|---|---|---|
| 2.1 | Are at least two alternatives documented? | |
| 2.2 | Does each rejected alternative have a stated reason for rejection? | |
| 2.3 | Is the "do nothing / defer" option addressed? | |

### 3. Decision and Rationale

| # | Question | Result |
|---|---|---|
| 3.1 | Is the chosen option stated unambiguously? | |
| 3.2 | Is the rationale traceable to the constraints from section 1? | |
| 3.3 | If the decision is portfolio-motivated (demonstrating a technology), is that stated explicitly rather than dressed up as purely technical rationale? | |

### 4. Consequences

| # | Question | Result |
|---|---|---|
| 4.1 | Are positive consequences documented? | |
| 4.2 | Are negative consequences / trade-offs documented? | |
| 4.3 | Does the ADR identify what becomes *harder* as a result of this decision? | |

### 5. Risk Identification

| # | Question | Result |
|---|---|---|
| 5.1 | Are operational risks identified? (cost overrun, quota exhaustion, cold-start latency, etc.) | |
| 5.2 | Are implementation risks identified? (framework bugs, version upgrades, complex wiring) | |
| 5.3 | Does each significant risk have a stated mitigation or an explicit acknowledgment that it is accepted? | |
| 5.4 | Are there risks that affect *other* ADRs (cascading risk)? If so, are those ADRs cross-referenced? | |

### 6. Security and Compliance

| # | Question | Result |
|---|---|---|
| 6.1 | Is the security surface of the decision identified? (auth boundaries, secrets, network exposure) | |
| 6.2 | Are secrets or credentials handled? If so, is an encryption-at-rest strategy named? | |
| 6.3 | Is the compliance posture documented? (GDPR, HIPAA, SOC 2 applicability stated or explicitly ruled out) | |
| 6.4 | If a compliance requirement would force a different decision, is that migration path documented? | |

### 7. Operability

| # | Question | Result |
|---|---|---|
| 7.1 | Is the decision observable? (logs, metrics, or traces identified that cover the decision's runtime behavior) | |
| 7.2 | Is there a runbook or documented procedure for failure modes introduced by this decision? | |
| 7.3 | Does the decision introduce shared mutable state? If so, is a cache-invalidation or consistency strategy present? | |

### 8. Reversibility

| # | Question | Result |
|---|---|---|
| 8.1 | Is the reversibility of the decision stated explicitly? (one-way door vs. two-way door) | |
| 8.2 | If the decision is hard to reverse, is the point of no return identified? | |
| 8.3 | If a migration path away from this decision exists, is it sketched at least at a high level? | |

### 9. Cross-ADR Consistency

| # | Question | Result |
|---|---|---|
| 9.1 | Does this decision depend on another ADR? If so, is it cross-referenced? | |
| 9.2 | Does this decision constrain or enable a future ADR? Is that relationship noted? | |
| 9.3 | Does this decision contradict any currently accepted ADR? | |

### 10. Enforcement and Validation

| # | Question | Result |
|---|---|---|
| 10.1 | Can this decision be violated accidentally? If so, is there a lint rule, CI check, or type constraint that catches it? | |
| 10.2 | Is the enforcement mechanism documented in the ADR (not just implemented silently in code)? | |
| 10.3 | Is there a test that fails when the decision's constraints are broken? | |

### 11. References

| # | Question | Result |
|---|---|---|
| 11.1 | Is there a `## References` section? | |
| 11.2 | Are references primary sources (official docs, specifications, foundational papers) rather than blog summaries? | |
| 11.3 | Are framework or technology references linked to official documentation? | |

---

## Review Outcome Template

Add this block to the ADR header table after review:

```
| Reviewed      | YYYY-MM-DD                     |
| Reviewer      | @handle                        |
| Outcome       | Pass / Pass with gaps          |
| Open Items    | #issue1, #issue2               |
```

---

## Gap Severity Guide

| Severity | Meaning | Action |
|---|---|---|
| **Critical** | Decision cannot be safely implemented without resolving the gap | Block milestone close until resolved |
| **High** | Gap introduces significant operational or security risk | File issue targeting current or next milestone |
| **Medium** | Gap reduces confidence or increases future rework | File issue; acceptable to defer one milestone |
| **Low** | Documentation or clarity improvement | Amend ADR inline; no separate issue required |

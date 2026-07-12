# ADR-034: Edge Rate Limiting for the Unauthenticated `/api/client-errors` Endpoint (Cloud Armor)

**Status:** Accepted
**Date:** 2026-07-11
**Closes:** [#808](https://github.com/brownm09/lifting-logbook/issues/808)
**Related:** [ADR-020](ADR-020-tail-based-sampling-policy.md) (tail-based sampling — the #806 addendum this implements mitigation 3 of), [ADR-032](ADR-032-cloud-run-api-public-invoker.md) (which flagged a Cloud Armor / rate-limit gate as a reasonable follow-up), [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) (Cloud Run / GKE topology)

---

## Context

`apps/web`'s `POST /api/client-errors` (added in #798 / PR #805) is a browser-beacon sink for
client-side mutation failures. It is **public and unauthenticated by necessity** — the failure it
reports may itself be an auth expiry, so Clerk must not gate it — and it records **one retained
ERROR span per accepted request** (the ADR-020 `errors` tail-sampling policy always keeps
error-status traces). That makes the endpoint a span-injection vector into the shared free-tier
Grafana Cloud / Tempo stack.

[#806](https://github.com/brownm09/lifting-logbook/issues/806) (PR #810) added an app-level
**same-origin guard** in the route handler that drops cross-origin *browser* beacons. But it cannot
stop **scripted** abuse: a `curl` loop sends no truthful `Origin`, so the guard classifies it
`no-origin` and allows it (dropping all no-`Origin` requests would also drop legitimate non-browser
reports). The ADR-020 **#806 addendum** recorded an infra-level rate limit as **mitigation (3)** —
the deferred layer this ADR delivers. At the time #808 was filed the abuse surface was **latent** —
[#804](https://github.com/brownm09/lifting-logbook/issues/804) had not yet wired `apps/web`'s server
runtime to the prod collector. **#804 has since landed**
([PR #814](https://github.com/brownm09/lifting-logbook/pull/814), merged 2026-07-11), so that coupling
is satisfied and the surface is now effectively live in prod. Enabling this rate limit is therefore the
immediate operational follow-up — tracked in
[#826](https://github.com/brownm09/lifting-logbook/issues/826), gated only on a domain / DNS cutover
(see Consequences).

**The infra reality that shapes the whole design:** there is no external load balancer in front of
the web app today. The web Cloud Run service is served directly off its `*.run.app` URL (`allUsers`
invoker, `cloud-run.tf`); a custom domain today would use a Cloud Run **domain mapping**
(`docs/deploy.md` → "Mapping a custom domain to Cloud Run"), which is a Google-managed frontend, not
a user-managed load balancer. **Cloud Armor rate limiting (`throttle` / `rate_based_ban`) only
attaches to a backend service behind an external Application Load Balancer** — it cannot attach to a
bare `run.app` URL or a Cloud Run domain mapping. So a real, enforcing rate limit on this endpoint
is not a small policy addition: it requires standing up a full external HTTPS ALB with a serverless
NEG in front of the web service, which the security policy then attaches to.

## Decision

Provision, in [`infra/terraform/edge-load-balancer.tf`](../../infra/terraform/edge-load-balancer.tf),
a complete **global external HTTPS Application Load Balancer** in front of the web Cloud Run service —
serverless NEG → backend service (Cloud Armor security policy attached) → URL map → target HTTPS
proxy → Google-managed SSL certificate → global static IP → `:443` forwarding rule, plus a `:80`→`:443`
redirect — and attach a **Cloud Armor backend security policy** whose rate-limit rule is scoped to the
sink path:

- A `throttle` rule (priority 1000) matched by the CEL expression
  `request.path == '/api/client-errors' || request.path.startsWith('/api/client-errors/')`,
  `enforce_on_key = "IP"`, `exceed_action = "deny(429)"`, threshold
  `var.client_error_rate_limit_count` (**default 120**) requests per 60s per source IP. Every other
  path falls through to the required default `allow` rule.
- **`throttle`, not `rate_based_ban`:** this is best-effort telemetry, so a legitimate bursty IP — a
  single failing page emits several beacons — must recover the instant it drops back under the
  threshold, rather than serving a ban. Excess requests get `429` **at the edge, before Cloud Run**,
  so they never create a retained ERROR span.

**The entire stack is gated behind a new `enable_edge_load_balancer` variable (default `false`).**
With the committed tfvars every resource in `edge-load-balancer.tf` is `count = 0`, so
`terraform plan` is a **no-op** and today's `run.app` topology is unchanged. The *stack* is therefore
inert by construction (flag off ⇒ `count = 0`), independent of the *surface* — which #804 has since made
live (see Context). Shipping default-off keeps enablement a deliberate operational step (it needs a
domain + DNS cutover, below) rather than coupling a public-URL change to this PR.

Enabling is **two phases**, deliberately decoupled so it never causes downtime. `enable_edge_load_balancer`
(phase 1) creates the LB, static IP, Cloud Armor policy, and managed cert while `run.app` keeps
serving; a *separate* `lock_web_ingress_to_lb` (phase 2) then flips the web Cloud Run service's
`ingress` to `INTERNAL_AND_CLOUD_LOAD_BALANCING` (`cloud-run.tf`) so the public `run.app` URL can no
longer **bypass** the rate limit. A single flag doing both would lock `run.app` in the same apply
that first creates the LB — while its managed cert is still `PROVISIONING` — guaranteeing a dark
window; splitting the phases lets DNS be cut and the cert reach `ACTIVE` *before* ingress is locked.
Phase 1 requires `var.web_domain` (a Google-managed cert cannot be issued for `*.run.app`) and a DNS
cutover to the load-balancer IP; a precondition on the web service rejects `lock_web_ingress_to_lb = true`
unless `enable_edge_load_balancer = true`.

### Why the whole load balancer, not just a policy

A `google_compute_security_policy` with no backend service referencing it enforces nothing — Cloud
Armor rate limiting has no attachment point without a backend service behind an external ALB. The
load balancer is the irreducible substrate for the rate limit the issue asks for, so authoring a
coherent (if inert-by-default) whole is the honest deliverable rather than a fragment that cannot
work.

## Consequences

**Positive:**

- The scripted-abuse vector (ADR-020 #806 addendum mitigation 3) gains a real, path-scoped, per-IP
  bound. A single-IP `curl` flood is capped at the threshold; excess is `429`'d before Cloud Run, so
  it creates no retained span.
- **Zero risk to merge and zero change today.** Flag-off ⇒ `count = 0` ⇒ no-op plan; nothing about
  the `run.app` serving path changes until an operator deliberately enables it.
- **Reversible.** Roll back in reverse order — unset `lock_web_ingress_to_lb` and apply first (this
  restores `run.app` public ingress), then unset `enable_edge_load_balancer`. The threshold is a
  variable, so tightening/loosening the limit needs no code change.

**Negative / accepted:**

- Enabling is a genuine topology change, not a flag flip in isolation: it needs a domain + managed
  cert + a DNS cutover to the LB IP, and phase 2 locks `run.app` to LB-only. The two-phase split
  (above) is what keeps this downtime-free — the operator must still complete phase 1 + DNS + cert
  before flipping phase 2, but the code no longer forces both into one apply. Captured in the enable
  procedure below.
- A standing monthly LB cost when enabled — two global forwarding rules + a reserved static IP +
  per-GB processing (order-of-magnitude ~$20+/mo; estimate, not a quote). `$0` while off by default.
- A **per-IP** throttle does not bound a **distributed** (many-IP) flood; that is inherent to per-IP
  keying, and `enforce_on_key = "ALL"` would risk dropping legitimate traffic during a real
  error storm. If distributed abuse proves real, reconsider the OTel Collector composite rate limiter
  (ADR-020 leaves it rejected only for *legitimate* traffic).
- The staging Cloud Run A/B replica and the `run.app`-based deploy / integration-test probes assume
  `run.app` is publicly reachable; enabling the ingress lockdown in an environment would break those
  unless they are repointed at the LB. Production is Cloud-Run-only (`enable_gke = false`) — enable
  there first.

### Enable procedure (#804 has landed — now actionable; tracked in #826)

**Phase 1 — stand up the LB (`run.app` keeps serving; no downtime):**

1. Choose the public domain. Set `web_domain` and `enable_edge_load_balancer = true` for the target
   environment (tfvars or `-var`). Leave `lock_web_ingress_to_lb` at its default `false`.
2. `terraform apply` — creates the LB, static IP, Cloud Armor policy, and the managed cert (which
   starts in `PROVISIONING`). `run.app` is untouched and still serving.
3. `terraform output edge_lb_ip` → create the DNS **A** record `web_domain` → that IP.
4. Wait for the managed certificate to reach `ACTIVE` (can take up to ~60 min after DNS resolves).
5. Verify the LB serves: `https://<web_domain>` returns the app, and a burst above the threshold from
   one IP receives `429` on `/api/client-errors` (the backend service has request logging on, so the
   Cloud Armor throttle verdict appears in Cloud Logging).

**Phase 2 — close the `run.app` bypass (only after phase 1 is verified):**

6. Set `lock_web_ingress_to_lb = true` and `terraform apply` — flips the web service ingress to
   `INTERNAL_AND_CLOUD_LOAD_BALANCING`.
7. Confirm the `run.app` URL now rejects direct public traffic (ingress lockdown effective) while
   `https://<web_domain>` still serves.

**Roll back** in reverse: unset `lock_web_ingress_to_lb` and apply (restores `run.app` public
ingress), then unset `enable_edge_load_balancer` and apply, then remove the DNS record.

## Alternatives Considered

### App-level rate limit in the Next.js route

Rejected — and explicitly deferred by #806. An in-memory limiter does not survive multiple Cloud Run
instances without a shared store, it is not infra-level, and #806 scoped it out precisely to hand the
robust bound to infra. This ADR is the infra follow-up #806 named.

### Cloud Run domain mapping instead of an external ALB

A Cloud Run domain mapping is a Google-managed frontend with **no Cloud Armor attachment point** — it
cannot carry a rate-limit policy. It solves custom domains, not rate limiting.

### OTel Collector composite / rate-limiting tail-sampling policy

ADR-020 keeps this rejected for *legitimate* traffic. Reconsider it specifically for the client-error
span source only if the infra limit proves insufficient (e.g. for distributed abuse the per-IP
throttle cannot bound).

### `rate_based_ban` instead of `throttle`

A harder bound, but it bans a key for `ban_duration_sec` after a breach. Rejected as the default
because a legitimate bursty or CGNAT-shared IP would then serve a ban on best-effort telemetry.
`throttle` smooths without a penalty; `rate_based_ban` remains a small change (swap the action and add
the ban fields) if a hard ban is later wanted.

## Verification

- `terraform fmt` reports no changes; `terraform validate` succeeds (provider-schema-valid resource
  arguments) for `infra/terraform`.
- With the committed tfvars (flag off), the stack is `count = 0`, so the CI advisory
  `terraform plan` shows no changes for it. A full local `plan` is not runnable without GCP
  credentials + the GCS backend (as for all of this module), so `validate` + the `count`-gating are
  the local checks; the CI prod plan is the backstop.
- When enabled (tracked in #826): the enable-procedure verification steps above.

## References

- [Google Cloud Armor — Rate limiting overview](https://cloud.google.com/armor/docs/rate-limiting-overview) — `throttle` vs. `rate_based_ban`, `enforce_on_key`, and threshold/interval semantics; the mechanism this ADR's rule uses.
- [Google Cloud — Set up an external Application Load Balancer with Cloud Run (serverless NEG)](https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless) — the exact LB topology (serverless NEG → backend service → URL map → HTTPS proxy → forwarding rule) provisioned here, and where a Cloud Armor policy attaches.
- [Google Cloud — Serverless network endpoint groups (NEGs) overview](https://cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts) — how a Cloud Run service is placed behind an external ALB backend service, the substrate Cloud Armor requires.
- [Google Cloud Run — Restricting network ingress](https://cloud.google.com/run/docs/securing/ingress) — the `INTERNAL_AND_CLOUD_LOAD_BALANCING` setting used to stop the `run.app` URL bypassing the load balancer and its rate limit.
- [ADR-020 — Tail-Based Sampling Policy](ADR-020-tail-based-sampling-policy.md) — the `errors`-always policy and the #806 addendum that records this rate limit as mitigation (3), plus the retained-ERROR-span cost model motivating it.

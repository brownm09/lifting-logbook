# Runbook: Auth Provider Outage

**Triggers:** Surge in 401/403 responses in Grafana; Clerk status incident confirmed at
[status.clerk.com](https://status.clerk.com); JWT verification errors in structured logs
**Default severity:** SEV2 — authenticated users cannot access the application
**Dashboard:** Grafana → Lifting Logbook → API RED → Error Rate panel (filter by 4xx)

---

## Symptom

- Users report being logged out or unable to log in
- API logs contain JWT verification errors:
  ```
  JsonWebTokenError: invalid signature
  ClerkApiError: unauthenticated
  ```
- Grafana Explore → Loki shows a surge in 401 or 403 responses
- The API RED dashboard shows an elevated error rate from auth-gated endpoints

---

## Likely causes

1. **Clerk service outage** — Clerk's authentication service is degraded or down.
   Confirmed via [status.clerk.com](https://status.clerk.com).
2. **JWT signing key rotation** — Clerk has rotated its JWKS (JSON Web Key Set) and
   the API is still validating against a cached old key.
3. **`CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` expired or revoked** — the API key
   configured in the Kubernetes secret is no longer valid.
4. **Webhook delivery failure** — Clerk webhooks (user creation, session events) are
   failing silently, causing user-sync inconsistencies.
5. **Network timeout to Clerk JWKS endpoint** — the API pod cannot reach
   `https://api.clerk.com` to fetch the current signing keys, causing all JWT
   verifications to fail.

---

## Diagnosis

### 1. Check Clerk status

Go to [status.clerk.com](https://status.clerk.com). If Clerk has an active incident,
the outage is external. No remediation is possible until Clerk resolves it — communicate
status to users and monitor for recovery.

### 2. Find auth errors in logs

In Grafana Explore → Loki:

```logql
{service_name="lifting-logbook-api"} |= "unauthenticated" | json
```

```logql
{service_name="lifting-logbook-api"} |= "401" | json
```

Look for the specific error message and which endpoint is failing.

### 3. Check for JWKS-related errors

```logql
{service_name="lifting-logbook-api"} |= "jwks" | json
```

If the API is unable to fetch JWKS, it typically logs a network error or timeout
pointing at `api.clerk.com`. This indicates a network policy or DNS issue, not a
Clerk outage.

### 4. Verify the Clerk API key

```sh
kubectl get secret api-env -o jsonpath='{.data.CLERK_SECRET_KEY}' | base64 -d
```

Take the key value and verify it is valid in the Clerk dashboard:
Dashboard → API Keys → verify the key exists and is not marked as revoked.

### 5. Test JWKS reachability from a pod

```sh
kubectl exec -it <api-pod-name> -- sh
curl -s https://api.clerk.com/.well-known/jwks.json | head -c 200
```

A successful response returns JSON. A timeout or connection error indicates a network
issue from inside the cluster.

---

## Remediation

1. **Clerk service outage:** wait for Clerk to resolve the incident. Post a status update
   in the incident channel. If the outage is prolonged (> 2 hours), consider whether
   a maintenance page is appropriate.

2. **JWKS cache stale after key rotation:** restart the API pods to force a fresh JWKS
   fetch. Clerk's `@clerk/backend` SDK caches JWKS in memory; a pod restart clears
   the cache:
   ```sh
   kubectl rollout restart deployment/api
   ```

3. **Invalid API key:** generate a new key in the Clerk dashboard and update the
   Kubernetes secret, then restart the API pods:
   ```sh
   kubectl create secret generic api-env \
     --from-literal=CLERK_SECRET_KEY="<new-key>" \
     --dry-run=client -o yaml | kubectl apply -f -
   kubectl rollout restart deployment/api
   ```

4. **Network timeout to Clerk:** check the GKE network policy and egress rules. Clerk's
   JWKS endpoint must be reachable from the API pod on port 443. If a recent network
   policy change blocked egress, revert it:
   ```sh
   kubectl get networkpolicies
   kubectl describe networkpolicy <policy-name>
   ```

---

## Escalation

If the issue is not resolved after working through this runbook:

1. Confirm whether it is a Clerk incident (check status page) or an internal issue
   (network, misconfiguration).
2. For a Clerk incident: there is nothing to escalate internally — monitor the status
   page and communicate timeline to users.
3. For an internal issue: escalate to the engineering lead with the specific error
   message and the kubectl/Loki output gathered above.

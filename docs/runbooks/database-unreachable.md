# Runbook: Database Unreachable

**Triggers:** DB connection errors in structured logs; `APIHighErrorRate` accompanied by
`"database"` and `"error"` in log lines; Prisma connection exceptions in traces
**Default severity:** SEV1 — all DB-backed endpoints fail when Postgres is unreachable
**Dashboard:** Grafana → Lifting Logbook → API RED → Error Rate panel

---

## Symptom

- API returns 500 on all endpoints that read or write data
- Structured logs contain Prisma connection errors:
  ```
  PrismaClientInitializationError: Can't reach database server
  ```
  or connection pool exhaustion:
  ```
  Timed out fetching a new connection from the connection pool
  ```
- In Grafana Explore → Tempo, spans show `db.system = postgresql` with error status
- The `APIHighErrorRate` alert has fired or is close to threshold

---

## Likely causes

1. **Postgres pod crashed or is restarting** — the pod is in `CrashLoopBackOff` or
   `OOMKilled`.
2. **Network policy blocking API → Postgres traffic** — a recent Kubernetes network
   policy change is preventing the connection.
3. **Connection pool exhausted** — traffic spike or connection leak has saturated
   Prisma's connection pool, causing new requests to time out.
4. **Wrong or rotated credentials** — the `DATABASE_URL` secret was updated but the
   API pods have not been restarted to pick up the new value.
5. **Postgres storage full** — the PVC backing Postgres has run out of space and the
   database has gone read-only or crashed.

---

## Diagnosis

### 1. Check Postgres pod status

```sh
kubectl get pods -l app=postgres
kubectl describe pod <postgres-pod-name>
```

Look for `CrashLoopBackOff`, `OOMKilled`, or failed readiness probes. Check the pod
logs for crash output:

```sh
kubectl logs <postgres-pod-name> --previous
```

### 2. Check the connection from the API pod

```sh
kubectl exec -it <api-pod-name> -- sh
# Inside the pod:
nc -zv <postgres-service-name> 5432
```

If the connection is refused, the network path is broken (network policy or pod down).
If it hangs, the pool may be exhausted.

### 3. Check for connection pool errors

In Grafana Explore → Loki:

```logql
{service_name="lifting-logbook-api"} |= "connection pool" | json
```

A high rate of "Timed out fetching" messages indicates pool exhaustion rather than a
connectivity failure.

### 4. Verify the DATABASE_URL secret

```sh
kubectl get secret api-env -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

Confirm the hostname, port, user, and database name are correct.

### 5. Check Postgres storage

```sh
kubectl exec -it <postgres-pod-name> -- df -h /var/lib/postgresql/data
```

If usage is at or near 100%, the database is at risk of data-loss-causing crashes.

---

## Remediation

1. **Pod crashed:** restart the Postgres pod:
   ```sh
   kubectl rollout restart deployment/postgres   # or statefulset, depending on config
   ```
   Wait for the pod to reach `Running` with passing readiness probes before continuing.

2. **Network policy issue:** check recently applied network policies and revert if a
   new policy blocks port 5432:
   ```sh
   kubectl get networkpolicies
   kubectl describe networkpolicy <policy-name>
   ```

3. **Connection pool exhausted:** restart the API deployment to flush stale connections:
   ```sh
   kubectl rollout restart deployment/api
   ```
   If this recurs, open a GitHub issue to increase the pool size in `schema.prisma`
   (`connection_limit`) or add a connection pooler (PgBouncer).

4. **Wrong credentials:** update the `DATABASE_URL` key in the Kubernetes secret
   and restart the API pods to pick up the change:
   ```sh
   kubectl patch secret api-env -p '{"stringData":{"DATABASE_URL":"<correct-url>"}}'
   kubectl rollout restart deployment/api
   ```

5. **Storage full:** this requires immediate action to avoid data corruption. Expand the
   PVC or delete old data under supervision. Escalate to the engineering lead immediately.

---

## Escalation

If Postgres does not recover after restart, or if there is any risk of data loss:

1. Escalate to SEV1 and loop in the engineering lead immediately.
2. Do not attempt to delete Postgres data or expand storage without guidance — risk of
   making data loss worse.
3. If storage is full, take the API offline (scale replicas to 0) to prevent partial
   writes that could corrupt data:
   ```sh
   kubectl scale deployment/api --replicas=0
   ```

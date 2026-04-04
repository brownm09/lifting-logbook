# ADR-009: Infrastructure — Kubernetes (GKE Autopilot) Primary, Cloud Run Comparison

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

The application requires a hosting platform for the API server and web frontend. Two approaches
are being evaluated: Kubernetes (via GKE Autopilot) as the primary deployment target, and Google
Cloud Run as a comparison target. An explicit goal is to demonstrate Kubernetes proficiency while
also quantifying the operational and cost tradeoffs between the two platforms.

---

## Decision

Deploy to **GKE Autopilot** as the primary platform. Deploy the same container image to **Cloud
Run** as a secondary target for A/B infrastructure comparison. Both targets are provisioned via
**Terraform**. Application manifests for Kubernetes are managed via **Helm**.

### Project Structure

```
infra/
  terraform/
    main.tf                # GCP project, VPC, IAM, Cloud SQL, Load Balancer
    gke.tf                 # GKE Autopilot cluster
    cloud-run.tf           # Cloud Run services
    variables.tf
    outputs.tf
  kubernetes/
    charts/
      api/                 # Helm chart: Deployment, Service, HPA, ConfigMap, Secrets
      web/                 # Helm chart: Deployment, Service, Ingress
    values/
      production.yaml
      staging.yaml
  cloud-run/
    api-service.yaml       # Cloud Run service definition
    web-service.yaml
```

### Traffic Splitting for A/B Comparison

A **Google Cloud Load Balancer** with URL map rules splits traffic between GKE and Cloud Run.
Initial split: 90% GKE / 10% Cloud Run. Split is adjusted via Terraform without redeployment.

```
Client → Cloud Load Balancer
           ├── 90% → GKE Autopilot (api Deployment)
           └── 10% → Cloud Run (api service)
```

Both targets receive the same Docker image, built from the same `apps/api/Dockerfile` and
published to **Google Artifact Registry** via CI/CD.

### Kubernetes Configuration (API)

```yaml
# charts/api/templates/deployment.yaml (excerpt)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: ARTIFACT_REGISTRY/api:{{ .Values.image.tag }}
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Rationale

**Why GKE Autopilot over standard GKE:**
- Autopilot manages node pools, node upgrades, and bin packing automatically. This provides
  genuine Kubernetes artifacts (Deployments, Services, HPA, Helm charts, RBAC, Ingress) without
  the overhead of managing node pool sizing and OS patching.
- The portfolio artifact is the Kubernetes manifests and Helm charts — Autopilot does not
  diminish these. It only removes the node management layer, which is appropriate for a solo
  developer and most enterprise managed Kubernetes deployments.

**Why Helm:**
- Helm is the de facto standard for Kubernetes application packaging. Helm charts are the
  primary artifact that demonstrates Kubernetes proficiency in a portfolio context.
- Values files per environment (staging, production) show environment-specific configuration
  discipline.

**Why Terraform for IaC:**
- Terraform is the dominant IaC tool across cloud providers. It manages both GKE and Cloud Run
  from the same codebase, making the A/B comparison infrastructure explicitly code-defined.
- State is stored in a GCS backend for team-readiness.

**Why Cloud Run as a comparison target:**
- Cloud Run scales to zero, eliminating idle compute cost for low-traffic periods.
- Cold start behavior (< 1s for a Node.js container in practice) is a measurable quantity.
- Running both allows empirical comparison of: cost per request, scaling latency, operational
  complexity (Cloud Run requires no manifest maintenance), and cold start impact on p99 latency.

**Cost estimate (GKE Autopilot):**
- Autopilot pricing is per pod resource request. At 2 replicas × 250m CPU × 256Mi memory:
  ~$30–50/month at GCP us-central1 rates. Suitable for a portfolio/side project.

---

## Metrics Captured for A/B Comparison

| Metric | Tool |
|---|---|
| Request latency (p50, p95, p99) | Cloud Monitoring |
| Cold start frequency and duration | Cloud Run metrics |
| Cost per 1M requests | GCP Billing export → BigQuery |
| Scale-out time under load | Cloud Monitoring + load test (k6) |
| Operational events (restarts, OOM kills) | GKE / Cloud Run logs |

Results documented in `docs/infrastructure/gke-vs-cloud-run-comparison.md`.

---

## Consequences

- Kubernetes manifests (Helm charts) require maintenance as the application evolves. This is
  accepted as a deliberate investment in demonstrating operational depth.
- GKE Autopilot has a minimum billing floor even at low replica counts. Cloud Run is effectively
  free at very low traffic volumes. This cost difference is part of what is being measured.
- The load balancer configuration (traffic split) is Terraform-managed, making the A/B ratio
  adjustable without redeployment or downtime.
- CI/CD pipeline (GitHub Actions) builds, tests, and pushes the Docker image, then deploys to
  both GKE (via `helm upgrade`) and Cloud Run (via `gcloud run deploy`) in parallel.

---

## Alternatives Considered

**Standard GKE (non-Autopilot):** Full control over node pools. Appropriate for cost optimization
at scale (committed use discounts on specific machine types). Ruled out for this project because
node pool management adds operational overhead disproportionate to the scale.

**AWS EKS / Azure AKS:** Comparable managed Kubernetes offerings on other clouds. GCP is chosen
because Google Sheets API and Firebase ([ADR-012](ADR-012-analytics-and-ab-testing.md)) are
Google products, reducing cross-cloud complexity.

**Fly.io / Railway / Render:** Excellent developer experience, lower operational overhead, and
cheaper for small workloads. Not chosen because GKE has stronger portfolio signal for a director
of engineering role targeting enterprise environments.

**Kubernetes + Istio service mesh:** Istio would enable more sophisticated traffic management
(circuit breaking, mTLS, richer A/B splitting). Appropriate for a microservice architecture.
Ruled out as premature — the application is a monolith at this stage and Istio's operational
cost is not justified.

# Deployment Topology

GKE Autopilot is the primary deployment target. Cloud Run runs the same container image
as a secondary target for A/B infrastructure comparison. A Cloud Load Balancer splits
traffic between them. Shared infrastructure (VPC, Cloud SQL, Artifact Registry) is
provisioned by Terraform and consumed by both targets.

```mermaid
graph TB
    Client["Client\n(Browser / Mobile App)"]

    subgraph cicd["CI/CD"]
        GHA["GitHub Actions\n(build · test · push · deploy)"]
    end

    subgraph gcp["Google Cloud Platform"]
        AR["Artifact Registry\n(Docker images)"]
        LB["Cloud Load Balancer\n(URL map · traffic split)"]

        subgraph shared["Shared Infrastructure · Terraform"]
            VPC["VPC"]
            SQL["Cloud SQL\n(PostgreSQL)"]
        end

        subgraph gke["GKE Autopilot · primary (90%)"]
            API_K8s["api · Deployment\n2–10 pods · HPA\nHelm managed"]
            Web_K8s["web · Deployment\nHelm managed"]
        end

        subgraph cloudrun["Cloud Run · comparison (10%)"]
            API_CR["api · Service\n(scale-to-zero)"]
            Web_CR["web · Service\n(scale-to-zero)"]
        end
    end

    subgraph external["External Services"]
        Clerk["Clerk\n(Auth)"]
        SheetsAPI["Google Sheets API\n(per-user data store)"]
        Firebase["Firebase Analytics"]
    end

    Client --> LB
    LB -->|"90%"| API_K8s
    LB -->|"10%"| API_CR
    LB --> Web_K8s
    LB --> Web_CR
    GHA --> AR
    AR --> API_K8s
    AR --> API_CR
    AR --> Web_K8s
    AR --> Web_CR
    API_K8s --> SQL
    API_CR --> SQL
    API_K8s --> Clerk
    API_CR --> Clerk
    API_K8s --> SheetsAPI
    API_CR --> SheetsAPI
    API_K8s --> Firebase
    API_CR --> Firebase
    VPC --- SQL
    VPC --- API_K8s
    VPC --- API_CR
```

**Traffic split** is adjusted via Terraform without redeployment. Initial ratio: 90% GKE / 10%
Cloud Run. Metrics captured for comparison: request latency (p50/p95/p99), cold start
frequency, cost per request, and scale-out time under load.

**See also:** [ADR-009: Infrastructure — GKE Autopilot Primary, Cloud Run Comparison](../adr/ADR-009-infrastructure-kubernetes-cloud-run.md)

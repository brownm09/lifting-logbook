variable "project_id" {
  description = "GCP project ID (created manually during bootstrap)"
  type        = string
}

variable "billing_account" {
  description = "GCP billing account ID (format: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment: staging or production"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "app_name" {
  description = "Application name, used as a prefix for all resource names"
  type        = string
  default     = "lifting-logbook"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Name of the application database within the Cloud SQL instance"
  type        = string
  default     = "lifting_logbook"
}

variable "artifact_registry_region" {
  description = "Region for the Artifact Registry repository (shared across environments)"
  type        = string
  default     = "us-central1"
}

variable "gke_release_channel" {
  description = "GKE release channel for auto-upgrades"
  type        = string
  default     = "REGULAR"
}

variable "image_tag" {
  description = "Docker image tag to deploy (git SHA). Defaults to 'latest' for local Terraform runs."
  type        = string
  default     = "latest"
}

variable "enable_gke" {
  description = <<-EOT
    Provision the GKE Autopilot cluster (per ADR-009 A/B comparison).
    Set false for single-user / Cloud-Run-only deployments to skip ~$30/mo of cluster cost.

    Flipping on an existing environment:
      * true → false: `helm uninstall` every release in the cluster namespaces FIRST
        (otherwise cluster-managed cloud resources like LB IPs and PVCs are orphaned
        when terraform destroys the cluster), then apply. See docs/deploy.md.
      * false → true: no cleanup needed; apply, then push to main so CI deploys Helm
        releases onto the freshly created cluster.
  EOT
  type        = bool
  default     = true
}

variable "cloud_run_min_instances" {
  description = "Minimum Cloud Run instances per service. null = use environment default (1 in production, 0 in staging). Set 0 in production for scale-to-zero (adds ~2s cold start to first request, near-zero idle cost)."
  type        = number
  default     = null
}

variable "external_ar_reader_service_accounts" {
  description = <<-EOT
    Service account emails (in other GCP projects) granted
    `roles/artifactregistry.reader` on this environment's Artifact Registry.

    Set in staging tfvars to include the production CI/CD SA: build-images
    (.github/workflows/deploy.yml) re-auths to the prod SA at the tail of the
    job and uses `docker buildx imagetools create` to copy api:<sha> and
    web:<sha>-prod from the staging AR to the prod AR. The source-manifest
    read uses prod credentials, so the prod SA needs reader access here.
  EOT
  type        = list(string)
  default     = []
}

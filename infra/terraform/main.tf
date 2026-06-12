terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }

  # Remote state in GCS — bucket is created during bootstrap (see docs/deploy.md)
  backend "gcs" {
    bucket = "lifting-logbook-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  env_suffix  = var.environment == "production" ? "prod" : "stg"
  name_prefix = "${var.app_name}-${local.env_suffix}"
}

# ─── GCP APIs ────────────────────────────────────────────────────────────────

resource "google_project_service" "required_apis" {
  for_each = toset([
    "container.googleapis.com",         # GKE
    "run.googleapis.com",               # Cloud Run
    "sqladmin.googleapis.com",          # Cloud SQL
    "cloudkms.googleapis.com",          # Cloud KMS (ADR-014)
    "artifactregistry.googleapis.com",  # Artifact Registry
    "compute.googleapis.com",           # VPC, Load Balancer
    "servicenetworking.googleapis.com", # Private service networking (Cloud SQL)
    "secretmanager.googleapis.com",     # Secret Manager
    "vpcaccess.googleapis.com",         # Serverless VPC Access (Cloud Run connector)
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}

# GCP API enablement is eventually consistent — wait for propagation before
# creating any resources that depend on newly-enabled APIs.
# 60s was observed sufficient on fresh projects in testing; vpcaccess propagation
# can occasionally take longer. This only fires on create (first apply), not on
# re-applies where the APIs are already enabled.
resource "time_sleep" "api_propagation" {
  depends_on      = [google_project_service.required_apis]
  create_duration = "60s"
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "google_compute_network" "main" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  depends_on              = [time_sleep.api_propagation]
}

resource "google_compute_subnetwork" "main" {
  name          = "${local.name_prefix}-subnet"
  ip_cidr_range = var.environment == "production" ? "10.0.0.0/20" : "10.1.0.0/20"
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.environment == "production" ? "10.48.0.0/14" : "10.52.0.0/14"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.environment == "production" ? "10.52.0.0/20" : "10.56.0.0/20"
  }

  private_ip_google_access = true
}

# Allow GKE nodes egress (required for Autopilot)
resource "google_compute_router" "main" {
  name    = "${local.name_prefix}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${local.name_prefix}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# ─── Private Service Access (Cloud SQL) ──────────────────────────────────────

resource "google_compute_global_address" "private_ip_range" {
  name          = "${local.name_prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
  depends_on              = [google_project_service.required_apis]
}

# ─── Cloud SQL (Postgres 15) ──────────────────────────────────────────────────

resource "random_id" "db_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "main" {
  name             = "${local.name_prefix}-db-${random_id.db_suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 10

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.environment == "production"
      transaction_log_retention_days = var.environment == "production" ? 7 : 1
      backup_retention_settings {
        retained_backups = var.environment == "production" ? 7 : 2
      }
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
  }

  deletion_protection = var.environment == "production"
  depends_on          = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_database" "system" {
  name     = "${var.db_name}_system"
  instance = google_sql_database_instance.main.name
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  name     = "${var.app_name}-app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# ─── Secret Manager ──────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name_prefix}-database-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.app.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${var.db_name}"
}

resource "google_secret_manager_secret" "system_database_url" {
  secret_id = "${local.name_prefix}-system-database-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "system_database_url" {
  secret      = google_secret_manager_secret.system_database_url.id
  secret_data = "postgresql://${google_sql_user.app.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${var.db_name}_system"
}

resource "google_secret_manager_secret" "clerk_secret_key" {
  secret_id = "${local.name_prefix}-clerk-secret-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required_apis]
}

# Placeholder — value populated manually after Clerk app creation (see docs/deploy.md)
resource "google_secret_manager_secret_version" "clerk_secret_key" {
  secret      = google_secret_manager_secret.clerk_secret_key.id
  secret_data = "REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

resource "google_secret_manager_secret" "clerk_publishable_key" {
  secret_id = "${local.name_prefix}-clerk-publishable-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "clerk_publishable_key" {
  secret      = google_secret_manager_secret.clerk_publishable_key.id
  secret_data = "REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ── OTel Collector → Grafana Cloud auth headers (#474) ───────────────────────
# These are intentionally NOT Terraform-managed. Unlike the Clerk/DB secrets
# (created once at initial bootstrap), the OTel auth headers are created and
# populated together by scripts/bootstrap-otel-secrets.sh — the operator never
# wants a REPLACE_ME placeholder version to exist (the deploy's sync step would
# fail on it), and declaring them here would 409 against the script-created
# secrets on the next `terraform apply`. The deploy pipeline reads them with the
# CI/CD SA (roles/owner already grants secretAccessor) and syncs them into the
# otel-collector-secrets k8s Secret. Secret names:
#   ${name_prefix}-otel-otlp-auth-header   (traces + metrics → Tempo/Mimir)
#   ${name_prefix}-otel-loki-auth-header   (logs → Loki)

# ─── Cloud KMS (ADR-014 — credential encryption at rest) ─────────────────────

resource "google_kms_key_ring" "main" {
  name       = "${local.name_prefix}-keyring"
  location   = var.region
  depends_on = [google_project_service.required_apis]
}

resource "google_kms_crypto_key" "user_data_source" {
  name            = "user-data-source-kek"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# ─── Artifact Registry ───────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "images" {
  repository_id = var.app_name
  location      = var.artifact_registry_region
  format        = "DOCKER"
  description   = "Container images for ${var.app_name}"
  depends_on    = [google_project_service.required_apis]
}

# No cross-project Artifact Registry reader grants (#397 / ADR-029). Each
# environment's images are now pushed directly to that environment's AR by
# build-images (.github/workflows/deploy.yml) — the prod SA re-auths and
# build-pushes straight to the prod AR rather than copying from the staging AR
# via `docker buildx imagetools create`, so it no longer needs reader access on
# the staging AR. The previous `external_readers` member and its
# `external_ar_reader_service_accounts` variable were removed; applying this
# revokes the standing cross-project grant.

# ─── IAM — CI/CD service account ─────────────────────────────────────────────

resource "google_service_account" "cicd" {
  account_id   = "${local.name_prefix}-cicd"
  display_name = "${var.app_name} CI/CD (${var.environment})"
}

resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    # The CI/CD service account is the trusted automation identity for
    # this project — it runs `terraform apply` and `gcloud run deploy`
    # for every push to main. For a single-user production project,
    # granting Owner is the pragmatic choice:
    #
    #   * Editor + projectIamAdmin still excludes `setIamPolicy` on
    #     several resource types (Secret Manager secrets, KMS keys,
    #     storage buckets) that Terraform's `*_iam_member` resources
    #     need to manage. Closing each gap individually with a
    #     resource-specific admin role is a whack-a-mole pattern that
    #     this module has already iterated through twice (#301, #303).
    #   * Owner gives the SA the same authority the human operator
    #     already has when they run the first local terraform apply.
    #     The only thing Owner adds beyond Editor+projectIamAdmin that
    #     a deploy automation arguably should not have is the ability
    #     to delete the project itself — acceptable here because access
    #     to the SA is gated by WIF (only this repo's main branch).
    #
    # For multi-tenant production projects, replace `owner` with a
    # narrower combination (e.g., editor + projectIamAdmin +
    # secretmanager.admin + cloudkms.admin + storage.admin) and accept
    # that adding new resource types may require adding more roles.
    "roles/owner",

    # Identity-token issuance for workload identity is not in `owner`.
    "roles/iam.serviceAccountTokenCreator",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# TF state bucket IAM is managed out-of-band, not by Terraform.
# The bucket (lifting-logbook-prod-tfstate) lives in the lifting-logbook-prod GCP project.
# Neither SA can manage IAM on a cross-project bucket from within their own CI/CD context.
# Both SAs are granted roles/storage.objectAdmin via a one-time gcloud command (see docs/deploy.md §2).
#
# The removed block below drops the previously-tracked IAM binding from Terraform state
# without issuing a delete call, so existing grants are preserved.
removed {
  from = google_storage_bucket_iam_member.cicd_tfstate
  lifecycle {
    destroy = false
  }
}

# ─── IAM — Workload Identity Federation (keyless auth for GitHub Actions) ────

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${local.name_prefix}-github-pool"
  display_name              = "GitHub Actions (${var.environment})"
  depends_on                = [google_project_service.required_apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == 'brownm09/lifting-logbook'"
}

resource "google_service_account_iam_member" "cicd_wif_binding" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/brownm09/lifting-logbook"
}

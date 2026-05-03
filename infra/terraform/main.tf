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
  env_suffix = var.environment == "production" ? "prod" : "stg"
  name_prefix = "${var.app_name}-${local.env_suffix}"
}

# ─── GCP APIs ────────────────────────────────────────────────────────────────

resource "google_project_service" "required_apis" {
  for_each = toset([
    "container.googleapis.com",          # GKE
    "run.googleapis.com",                # Cloud Run
    "sqladmin.googleapis.com",           # Cloud SQL
    "cloudkms.googleapis.com",           # Cloud KMS (ADR-014)
    "artifactregistry.googleapis.com",   # Artifact Registry
    "compute.googleapis.com",            # VPC, Load Balancer
    "servicenetworking.googleapis.com",  # Private service networking (Cloud SQL)
    "secretmanager.googleapis.com",      # Secret Manager
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "google_compute_network" "main" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required_apis]
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
    ip_cidr_range = var.environment == "production" ? "10.52.0.0/20" : "10.53.0.0/20"
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
  replication { auto {} }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.app.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${var.db_name}"
}

resource "google_secret_manager_secret" "system_database_url" {
  secret_id = "${local.name_prefix}-system-database-url"
  replication { auto {} }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "system_database_url" {
  secret = google_secret_manager_secret.system_database_url.id
  secret_data = "postgresql://${google_sql_user.app.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${var.db_name}_system"
}

resource "google_secret_manager_secret" "clerk_secret_key" {
  secret_id = "${local.name_prefix}-clerk-secret-key"
  replication { auto {} }
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
  replication { auto {} }
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "clerk_publishable_key" {
  secret      = google_secret_manager_secret.clerk_publishable_key.id
  secret_data = "REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

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

# ─── IAM — CI/CD service account ─────────────────────────────────────────────

resource "google_service_account" "cicd" {
  account_id   = "${local.name_prefix}-cicd"
  display_name = "${var.app_name} CI/CD (${var.environment})"
}

resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/container.developer",          # GKE deploy
    "roles/run.admin",                    # Cloud Run deploy
    "roles/artifactregistry.writer",      # Push images
    "roles/secretmanager.secretAccessor", # Read secrets
    "roles/cloudsql.client",
    "roles/iam.serviceAccountTokenCreator",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cicd.email}"
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

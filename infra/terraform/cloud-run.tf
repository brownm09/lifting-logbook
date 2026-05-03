# ─── Cloud Run Services ───────────────────────────────────────────────────────
#
# Per ADR-009: Cloud Run receives 10% of traffic as the A/B comparison target.
# Metrics collected: cost per request, cold start latency, operational complexity.

locals {
  image_tag = var.image_tag
  api_image = "${var.artifact_registry_region}-docker.pkg.dev/${var.project_id}/${var.app_name}/api:${local.image_tag}"
  web_image = "${var.artifact_registry_region}-docker.pkg.dev/${var.project_id}/${var.app_name}/web:${local.image_tag}"
}

# ─── API ──────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name_prefix}-api"
  location = var.region

  template {
    service_account = google_service_account.api_workload.email

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.api_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "staging"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SYSTEM_DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.system_database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CLERK_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.clerk_secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "KMS_KEY_NAME"
        value = google_kms_crypto_key.user_data_source.id
      }
    }
  }

  depends_on = [google_project_service.required_apis]
}

# ─── Web ──────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "web" {
  name     = "${local.name_prefix}-web"
  location = var.region

  template {
    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    containers {
      image = local.web_image

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "staging"
      }

      env {
        name  = "PORT"
        value = "3001"
      }

      env {
        name  = "API_URL"
        value = "https://${google_cloud_run_v2_service.api.uri}"
      }

      env {
        name = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.clerk_publishable_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.api,
  ]
}

# ─── Allow unauthenticated access ────────────────────────────────────────────

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = google_cloud_run_v2_service.api.project
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = google_cloud_run_v2_service.web.project
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Serverless VPC Connector (private Cloud SQL access from Cloud Run) ───────

resource "google_vpc_access_connector" "main" {
  name          = "${local.env_suffix}-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = var.environment == "production" ? "10.8.0.0/28" : "10.8.1.0/28"
  depends_on    = [google_project_service.required_apis]
}

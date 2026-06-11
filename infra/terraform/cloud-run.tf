# ─── Cloud Run Services ───────────────────────────────────────────────────────
#
# Per ADR-009: Cloud Run receives 10% of traffic as the A/B comparison target.
# Metrics collected: cost per request, cold start latency, operational complexity.

locals {
  image_tag = var.image_tag
  # "bootstrap" is a sentinel used on first apply before CI/CD has pushed any images.
  # CI/CD overwrites this via gcloud run deploy; lifecycle.ignore_changes prevents Terraform
  # from reverting it on subsequent applies.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello:latest"
  api_image = var.image_tag == "bootstrap" ? local.placeholder_image : "${var.artifact_registry_region}-docker.pkg.dev/${var.project_id}/${var.app_name}/api:${local.image_tag}"
  web_image = var.image_tag == "bootstrap" ? local.placeholder_image : "${var.artifact_registry_region}-docker.pkg.dev/${var.project_id}/${var.app_name}/web:${local.image_tag}"

  # Cloud Run min instances. var.cloud_run_min_instances overrides the per-environment
  # default when set (use 0 in production for scale-to-zero / single-user deploys).
  cloud_run_min_instances = var.cloud_run_min_instances != null ? var.cloud_run_min_instances : (var.environment == "production" ? 1 : 0)
}

# ─── API ──────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name_prefix}-api"
  location = var.region

  template {
    service_account = google_service_account.api_workload.email

    scaling {
      min_instance_count = local.cloud_run_min_instances
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

  # Image and template updates are managed exclusively by gcloud run deploy in CI/CD.
  # Terraform creates the service on first apply; subsequent image/env/scale changes
  # are applied by the deploy-staging / deploy-production jobs, not Terraform.
  #
  # `client` and `client_version` are set by `gcloud run deploy` (e.g.,
  # "gcloud" / "568.0.0"). Without ignoring them, terraform sees them as drift
  # and tries to revert to null on the next apply. The revert triggers an
  # in-place Service modification, which Cloud Run validates by re-attempting
  # to start the current template's image. If that image is broken (e.g., a
  # bad deploy that pre-dates the current commit), the modification fails
  # with "container failed to start", blocking every subsequent terraform
  # apply even though the live image issue is unrelated to terraform.
  lifecycle {
    ignore_changes = [template, client, client_version]
  }

  depends_on = [google_project_service.required_apis]
}

# ─── Web ──────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "web" {
  name     = "${local.name_prefix}-web"
  location = var.region

  template {
    service_account = google_service_account.web_workload.email

    scaling {
      min_instance_count = local.cloud_run_min_instances
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
        name  = "API_URL"
        value = google_cloud_run_v2_service.api.uri
      }

      # Browser-facing API URL injected at runtime into window.__PUBLIC_CONFIG__
      # (#396 / ADR-028). On Cloud Run the browser reaches the same external API URL
      # as the server, so PUBLIC_API_URL == API_URL.
      env {
        name  = "PUBLIC_API_URL"
        value = google_cloud_run_v2_service.api.uri
      }

      # Runtime public config (#396 / ADR-028): consumed by the root layout and passed
      # to <ClerkProvider> as a prop — no longer NEXT_PUBLIC_ / bundle-inlined, which is
      # what restores the single build-once / promote-everywhere web image.
      env {
        name = "CLERK_PUBLISHABLE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.clerk_publishable_key.secret_id
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
    }
  }

  # Image and template updates managed by CI/CD (see lifecycle note on api service above).
  # client and client_version are also ignored for the same reason as the api service:
  # gcloud run deploy sets these on each CI deploy and Terraform would otherwise attempt
  # an in-place modification (creating a new revision) on every subsequent apply.
  lifecycle {
    ignore_changes = [template, client, client_version]
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.api,
    google_secret_manager_secret_iam_member.web_workload_clerk_secret_key,
  ]
}

# ─── Cloud Run workload identities ────────────────────────────────────────────

resource "google_service_account" "web_workload" {
  account_id   = "${local.name_prefix}-web-wi"
  display_name = "${var.app_name} web workload identity (${var.environment})"
}

# ─── Access control ───────────────────────────────────────────────────────────
#
# Web service is publicly accessible (serves the Next.js frontend to browsers).
# API service requires Cloud Run IAM authentication — only the web workload SA
# is granted roles/run.invoker so server-side API calls from Next.js succeed.
# See: https://cloud.google.com/run/docs/authenticating/service-to-service

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = google_cloud_run_v2_service.web.project
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_invoker_on_api" {
  project  = google_cloud_run_v2_service.api.project
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.web_workload.email}"
}

resource "google_secret_manager_secret_iam_member" "web_workload_publishable_key" {
  secret_id = google_secret_manager_secret.clerk_publishable_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_workload.email}"
}

resource "google_secret_manager_secret_iam_member" "web_workload_clerk_secret_key" {
  secret_id = google_secret_manager_secret.clerk_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_workload.email}"
}

# ─── Serverless VPC Connector (private Cloud SQL access from Cloud Run) ───────

resource "google_vpc_access_connector" "main" {
  name          = "${local.env_suffix}-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = var.environment == "production" ? "10.8.0.0/28" : "10.8.1.0/28"
  depends_on    = [google_project_service.required_apis]
}

# ─── Database migration job (ADR-027) ─────────────────────────────────────────
#
# Cloud Run Job that runs `prisma migrate deploy` against the environment's
# Cloud SQL database. The database has a private IP only, so a GitHub-hosted
# runner cannot reach it directly — this job runs *inside* the VPC via the same
# serverless connector the API service uses, then the deploy pipeline executes
# it (gcloud run jobs execute --wait) before the API revision goes live. A
# failed migration therefore fails the deploy and the last-good API revision
# keeps serving. Before this job existed, migrations were never applied by the
# pipeline (only ci.yml ran `migrate deploy`, against the CI test DB), so prod
# schema drifted silently and any endpoint touching a missing table 500'd
# (#458 / #460). See ADR-027.
#
# The container reuses the API image (it already ships the Prisma CLI,
# @prisma/engines, and the migrations under apps/api/prisma) and overrides the
# entrypoint to run migrations instead of the server. It runs as the API
# workload SA, which already holds roles/cloudsql.client and
# roles/secretmanager.secretAccessor (see api_workload_roles in gke.tf).
resource "google_cloud_run_v2_job" "migrate" {
  name     = "${local.name_prefix}-migrate"
  location = var.region

  template {
    template {
      service_account = google_service_account.api_workload.email

      # A migration must run exactly once. A retry of a half-applied migration
      # leaves a failed row in _prisma_migrations that Prisma refuses to step
      # past anyway, so retrying cannot help — fail fast and surface it.
      max_retries = 0

      vpc_access {
        connector = google_vpc_access_connector.main.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image = local.api_image

        # The API image WORKDIR is /app/apps/api, so the schema path is
        # relative to it. `migrate deploy` applies only pending migrations in
        # order (idempotent); `migrate status` then asserts a clean end-state,
        # so a non-zero exit (failed apply or leftover pending migration) fails
        # the job and, via `--wait`, the deploy.
        command = ["/bin/sh", "-c"]
        args = [
          "npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma migrate status --schema=prisma/schema.prisma"
        ]

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
    }
  }

  # The real image tag is set by the deploy pipeline via `gcloud run jobs
  # update --image` (Terraform applies with image_tag=bootstrap → placeholder).
  # Unlike the services — which ignore the whole `template` because gcloud run
  # deploy mutates many fields — the job's image is the only field gcloud
  # touches, so we ignore *only* the image and keep command/env/SA/VPC under
  # Terraform's control (changeable via a normal apply). client/client_version
  # are set by gcloud and would otherwise read as perpetual drift.
  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.required_apis]
}

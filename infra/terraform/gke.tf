# ─── GKE Autopilot Cluster ───────────────────────────────────────────────────
#
# Autopilot manages node provisioning and scaling automatically.
# Per ADR-009: GKE receives 90% of traffic; Cloud Run receives 10%.

resource "google_container_cluster" "main" {
  provider = google-beta

  name     = "${local.name_prefix}-cluster"
  location = var.region

  enable_autopilot = true

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.main.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  release_channel {
    channel = var.gke_release_channel
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.environment == "production" ? "172.16.0.0/28" : "172.16.1.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "all (tighten for production)"
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  depends_on = [
    google_project_service.required_apis,
    google_compute_subnetwork.main,
  ]
}

# ─── Kubernetes namespace ─────────────────────────────────────────────────────

# The namespace is created via Helm (see infra/kubernetes/values/).
# Terraform outputs the cluster credentials needed for kubectl/helm.

# ─── IAM — GKE workload identity for the API pod ────────────────────────────

resource "google_service_account" "api_workload" {
  account_id   = "${local.name_prefix}-api-wi"
  display_name = "${var.app_name} API workload identity (${var.environment})"
}

resource "google_project_iam_member" "api_workload_roles" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/cloudkms.cryptoKeyEncrypterDecrypter",
    "roles/cloudsql.client",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.api_workload.email}"
}

# Allow the Kubernetes service account (in the app namespace) to impersonate
# this GCP service account via Workload Identity.
resource "google_service_account_iam_member" "api_workload_k8s_binding" {
  service_account_id = google_service_account.api_workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.environment}/api]"
}

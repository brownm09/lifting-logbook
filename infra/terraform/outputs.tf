output "gke_cluster_name" {
  description = "GKE cluster name (used by helm deploy step in CI/CD)"
  value       = google_container_cluster.main.name
}

output "gke_cluster_location" {
  description = "GKE cluster region"
  value       = google_container_cluster.main.location
}

output "cloud_run_api_url" {
  description = "Cloud Run API service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_run_web_url" {
  description = "Cloud Run web service URL"
  value       = google_cloud_run_v2_service.web.uri
}

output "artifact_registry_host" {
  description = "Artifact Registry hostname for Docker push/pull"
  value       = "${var.artifact_registry_region}-docker.pkg.dev"
}

output "artifact_registry_repo" {
  description = "Full Artifact Registry repository path"
  value       = "${var.artifact_registry_region}-docker.pkg.dev/${var.project_id}/${var.app_name}"
}

output "cicd_service_account_email" {
  description = "CI/CD service account email (referenced in GitHub Actions secrets)"
  value       = google_service_account.cicd.email
}

output "workload_identity_provider" {
  description = "Workload Identity Federation provider resource name (used in GitHub Actions)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "kms_key_name" {
  description = "Cloud KMS crypto key name for credential encryption (ADR-014)"
  value       = google_kms_crypto_key.user_data_source.id
}

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

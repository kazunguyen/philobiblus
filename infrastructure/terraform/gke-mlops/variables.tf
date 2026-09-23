variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "sql_instance_name" {
  description = "Name of the existing Cloud SQL instance"
  type        = string
}

variable "mlops_namespace" {
  description = "Kubernetes namespace for MLOps"
  type        = string
  default     = "philobiblus-mlops"
}

variable "app_namespace" {
  description = "Kubernetes namespace for the main app"
  type        = string
  default     = "philobiblus"
}

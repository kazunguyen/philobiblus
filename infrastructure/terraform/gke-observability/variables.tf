variable "project_id" {
  description = "Google Cloud project that owns the GKE cluster."
  type        = string
}

variable "region" {
  description = "Google Cloud region for regional monitoring resources."
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Deployment environment used in names and labels."
  type        = string
  default     = "dev"
}

variable "state_bucket_name" {
  description = "GCS bucket used for Terraform state."
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name displayed in the dashboard."
  type        = string
}

variable "namespace" {
  description = "Namespace containing Philobiblus workloads."
  type        = string
  default     = "philobiblus"
}

variable "alert_email" {
  description = "Email address that receives operational alerts."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}

variable "enable_alerting" {
  description = "Whether Terraform should create alert policies and the email channel."
  type        = bool
  default     = true
}

variable "enable_rate_limit_alerts" {
  description = "Create rate-limit alert policies only after Managed Prometheus has indexed rate_limit_operations_total."
  type        = bool
  default     = false
}

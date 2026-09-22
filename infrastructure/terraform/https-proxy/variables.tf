variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Google Cloud region."
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "state_bucket_name" {
  description = "GCS Terraform state bucket."
  type        = string
}

variable "proxy_image" {
  description = "Immutable container image for the HTTPS proxy."
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.proxy_image))
    error_message = "proxy_image must use an immutable sha256 digest."
  }
}

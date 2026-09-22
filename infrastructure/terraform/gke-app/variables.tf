variable "project_id" {
  type        = string
  description = "Google Cloud project ID."
}

variable "region" {
  type        = string
  description = "Google Cloud region."
  default     = "asia-southeast1"
}

variable "environment" {
  type        = string
  description = "Deployment environment."
  default     = "dev"
}

variable "state_bucket_name" {
  type        = string
  description = "GCS Terraform state bucket."
}

variable "namespace" {
  type        = string
  description = "Kubernetes namespace for Philobiblus."
  default     = "philobiblus"
}

variable "backend_image" {
  type        = string
  description = "Immutable backend image reference."

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.backend_image))
    error_message = "backend_image must use an immutable sha256 digest."
  }
}

variable "recommendation_image" {
  type        = string
  description = "Immutable recommendation image reference."

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.recommendation_image))
    error_message = "recommendation_image must use an immutable sha256 digest."
  }
}

variable "frontend_origin" {
  type        = string
  description = "Allowed GitHub Pages origin without a trailing path."

  validation {
    condition     = can(regex("^https://[^/]+$", var.frontend_origin))
    error_message = "frontend_origin must be an HTTPS origin without a path."
  }
}

variable "gateway_host" {
  type        = string
  description = "Optional DNS hostname for the Gateway. Empty exposes an HTTP IP only."
  default     = ""
}

variable "gateway_https_enabled" {
  type        = bool
  description = "Enable HTTPS on the GKE Gateway using Certificate Manager."
  default     = false
}

variable "gateway_certificate_map_name" {
  type        = string
  description = "Certificate Manager certificate map name to attach to Gateway. If empty, reads from platform remote state."
  default     = ""
}

variable "gateway_http_to_https_redirect" {
  type        = bool
  description = "Enable HTTP to HTTPS redirect route on the Gateway."
  default     = false
}

variable "include_imgbb_secret" {
  type        = bool
  description = "Sync the ImgBB secret after it has an enabled Secret Manager version."
  default     = false
}


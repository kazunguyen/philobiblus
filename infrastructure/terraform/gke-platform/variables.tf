variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Region for the GKE Autopilot cluster."
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "state_bucket_name" {
  description = "GCS bucket containing the Philobiblus Terraform states."
  type        = string
}

variable "protect_cluster" {
  description = "Prevent accidental GKE cluster deletion."
  type        = bool
  default     = true
}

variable "release_channel" {
  description = "GKE release channel."
  type        = string
  default     = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE", "EXTENDED"], var.release_channel)
    error_message = "release_channel must be RAPID, REGULAR, STABLE, or EXTENDED."
  }
}

variable "api_hostname" {
  description = "FQDN public API, for example api.example.com. Empty disables HTTPS resources."
  type        = string
  default     = ""

  validation {
    condition     = var.api_hostname == "" || can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$", var.api_hostname))
    error_message = "api_hostname must be empty or a lowercase FQDN with no scheme, port, or path."
  }
}

variable "enable_gateway_https" {
  description = "Create Certificate Manager resources only after a controllable DNS hostname exists."
  type        = bool
  default     = false
}


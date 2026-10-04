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

variable "enable_cloud_armor" {
  description = "Create the Cloud Armor policy that protects the GKE backend Service."
  type        = bool
  default     = true
}

variable "cloud_armor_waf_rules_preview" {
  description = "Keep Cloud Armor WAF rules in preview until reviewed."
  type        = bool
  default     = true
}

variable "cloud_armor_sensitive_rate_limit_preview" {
  description = "Keep login, registration, upload, and recommendation limits in preview until reviewed."
  type        = bool
  default     = true
}

variable "cloud_armor_general_rate_limit_preview" {
  description = "Keep the general API rate limit in preview until reviewed."
  type        = bool
  default     = true
}

variable "cloud_armor_login_count" {
  type        = number
  description = "Login requests allowed per Cloud Armor interval and client IP."
  default     = 20

  validation {
    condition     = var.cloud_armor_login_count >= 1 && var.cloud_armor_login_count <= 10000
    error_message = "cloud_armor_login_count must be between 1 and 10000."
  }
}

variable "cloud_armor_login_interval_seconds" {
  type        = number
  description = "Cloud Armor login rate-limit interval in seconds."
  default     = 300

  validation {
    condition     = contains([10, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2700, 3600], var.cloud_armor_login_interval_seconds)
    error_message = "cloud_armor_login_interval_seconds must be a Cloud Armor supported interval."
  }
}

variable "cloud_armor_register_count" {
  type        = number
  description = "Registration requests allowed per Cloud Armor interval and client IP."
  default     = 10

  validation {
    condition     = var.cloud_armor_register_count >= 1 && var.cloud_armor_register_count <= 10000
    error_message = "cloud_armor_register_count must be between 1 and 10000."
  }
}

variable "cloud_armor_register_interval_seconds" {
  type        = number
  description = "Cloud Armor registration rate-limit interval in seconds."
  default     = 600

  validation {
    condition     = contains([10, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2700, 3600], var.cloud_armor_register_interval_seconds)
    error_message = "cloud_armor_register_interval_seconds must be a Cloud Armor supported interval."
  }
}

variable "cloud_armor_upload_count" {
  type        = number
  description = "Cover uploads allowed per Cloud Armor interval and client IP."
  default     = 10

  validation {
    condition     = var.cloud_armor_upload_count >= 1 && var.cloud_armor_upload_count <= 10000
    error_message = "cloud_armor_upload_count must be between 1 and 10000."
  }
}

variable "cloud_armor_upload_interval_seconds" {
  type        = number
  description = "Cloud Armor upload rate-limit interval in seconds."
  default     = 600

  validation {
    condition     = contains([10, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2700, 3600], var.cloud_armor_upload_interval_seconds)
    error_message = "cloud_armor_upload_interval_seconds must be a Cloud Armor supported interval."
  }
}

variable "cloud_armor_recommendation_count" {
  type        = number
  description = "Recommendation requests allowed per Cloud Armor interval and client IP."
  default     = 60

  validation {
    condition     = var.cloud_armor_recommendation_count >= 1 && var.cloud_armor_recommendation_count <= 10000
    error_message = "cloud_armor_recommendation_count must be between 1 and 10000."
  }
}

variable "cloud_armor_recommendation_interval_seconds" {
  type        = number
  description = "Cloud Armor recommendation rate-limit interval in seconds."
  default     = 60

  validation {
    condition     = contains([10, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2700, 3600], var.cloud_armor_recommendation_interval_seconds)
    error_message = "cloud_armor_recommendation_interval_seconds must be a Cloud Armor supported interval."
  }
}

variable "cloud_armor_general_count" {
  type        = number
  description = "General API requests allowed per Cloud Armor interval and client IP."
  default     = 300

  validation {
    condition     = var.cloud_armor_general_count >= 1 && var.cloud_armor_general_count <= 10000
    error_message = "cloud_armor_general_count must be between 1 and 10000."
  }
}

variable "cloud_armor_general_interval_seconds" {
  type        = number
  description = "Cloud Armor general API rate-limit interval in seconds."
  default     = 60

  validation {
    condition     = contains([10, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2700, 3600], var.cloud_armor_general_interval_seconds)
    error_message = "cloud_armor_general_interval_seconds must be a Cloud Armor supported interval."
  }
}

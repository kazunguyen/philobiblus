variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "state_bucket_name" {
  type = string
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "backend_image" {
  type = string
}

variable "recommendation_image" {
  type = string
}

variable "allowed_origins" {
  type = list(string)

  validation {
    condition     = length(var.allowed_origins) > 0
    error_message = "At least one frontend origin is required."
  }
}

variable "alert_email" {
  type = string
}

variable "protect_runtime" {
  type    = bool
  default = true
}
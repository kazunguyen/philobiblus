locals {
  name          = "philobiblus-${var.environment}"
  https_enabled = var.enable_gateway_https && var.api_hostname != ""
}

data "terraform_remote_state" "foundation" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/foundation"
  }
}

resource "google_compute_global_address" "gateway" {
  project      = var.project_id
  name         = "${local.name}-gke-gateway"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"

  labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_container_cluster" "main" {
  project  = var.project_id
  name     = "${local.name}-gke"
  location = var.region

  description         = "Philobiblus ${var.environment} GKE Autopilot cluster"
  enable_autopilot    = true
  deletion_protection = var.protect_cluster

  network    = data.terraform_remote_state.foundation.outputs.network_id
  subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id

  networking_mode = "VPC_NATIVE"

  ip_allocation_policy {
    stack_type               = "IPV4"
    cluster_ipv4_cidr_block  = "/20"
    services_ipv4_cidr_block = "/24"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  release_channel {
    channel = var.release_channel
  }

  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  secret_manager_config {
    enabled = true

    rotation_config {
      enabled           = true
      rotation_interval = "300s"
    }
  }

  secret_sync_config {
    enabled = true

    rotation_config {
      enabled           = true
      rotation_interval = "300s"
    }
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "APISERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER",
      "HPA",
      "POD",
      "DEPLOYMENT",
      "STATEFULSET",
    ]

    managed_prometheus {
      enabled = true
    }
  }

  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "APISERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER",
      "WORKLOADS",
    ]
  }

  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  cost_management_config {
    enabled = true
  }

  maintenance_policy {
    daily_maintenance_window {
      start_time = "19:00"
    }
  }

  resource_labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle {
    precondition {
      condition     = data.terraform_remote_state.foundation.outputs.network_id != ""
      error_message = "Foundation network output is unavailable. Apply foundation first."
    }
  }
}

check "https_hostname_specified" {
  assert {
    condition     = !var.enable_gateway_https || var.api_hostname != ""
    error_message = "api_hostname must be provided when enable_gateway_https is true."
  }
}

resource "google_certificate_manager_dns_authorization" "api" {
  count       = local.https_enabled ? 1 : 0
  project     = var.project_id
  name        = "${local.name}-api-dnsauth"
  location    = "global"
  domain      = var.api_hostname
  type        = "PER_PROJECT_RECORD"
  description = "DNS authorization for ${var.api_hostname}"

  labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_certificate_manager_certificate" "api" {
  count       = local.https_enabled ? 1 : 0
  project     = var.project_id
  name        = "${local.name}-api-cert"
  location    = "global"
  description = "Google-managed certificate for ${var.api_hostname}"

  managed {
    domains            = [var.api_hostname]
    dns_authorizations = [google_certificate_manager_dns_authorization.api[0].id]
  }

  labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_certificate_manager_certificate_map" "api" {
  count       = local.https_enabled ? 1 : 0
  project     = var.project_id
  name        = "${local.name}-api-map"
  description = "Certificate map for ${var.api_hostname}"

  labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_certificate_manager_certificate_map_entry" "api" {
  count        = local.https_enabled ? 1 : 0
  project      = var.project_id
  name         = "${local.name}-api-entry"
  map          = google_certificate_manager_certificate_map.api[0].name
  hostname     = var.api_hostname
  certificates = [google_certificate_manager_certificate.api[0].id]
  description  = "Certificate map entry for ${var.api_hostname}"

  labels = {
    application = "philobiblus"
    environment = var.environment
    managed_by  = "terraform"
  }
}


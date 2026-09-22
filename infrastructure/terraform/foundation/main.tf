locals {
  name = "philobiblus-${var.environment}"

  services = toset([
    "artifactregistry.googleapis.com",
    "certificatemanager.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "main" {
  name                    = "${local.name}-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "run" {
  name                     = "${local.name}-run"
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = "10.20.0.0/24"
  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.required]
}

resource "google_compute_router" "run" {
  name    = "${local.name}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "run" {
  name                               = "${local.name}-nat"
  router                             = google_compute_router.run.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.run.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "philobiblus"
  description   = "Philobiblus runtime images"
  format        = "DOCKER"

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account" "backend" {
  account_id   = "philobiblus-backend"
  display_name = "Philobiblus backend runtime"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "recommendation" {
  account_id   = "philobiblus-recommend"
  display_name = "Philobiblus recommendation runtime"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "seed" {
  account_id   = "philobiblus-seed"
  display_name = "Philobiblus migration and seed job"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "backend_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "seed_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.seed.email}"
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name}-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.name}-jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "imgbb_api" {
  secret_id = "${local.name}-imgbb-api"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

locals {
  backend_secrets = {
    database_url = google_secret_manager_secret.database_url.id
    jwt_secret   = google_secret_manager_secret.jwt_secret.id
    imgbb_api    = google_secret_manager_secret.imgbb_api.id
  }

  seed_secrets = {
    database_url = google_secret_manager_secret.database_url.id
    jwt_secret   = google_secret_manager_secret.jwt_secret.id
  }
}

resource "google_secret_manager_secret_iam_member" "backend" {
  for_each = local.backend_secrets

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "seed" {
  for_each = local.seed_secrets

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.seed.email}"
}

resource "google_sql_database_instance" "postgres" {
  name             = "${local.name}-postgres"
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.protect_data

  settings {
    tier              = var.database_tier
    edition           = "ENTERPRISE"
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"

    disk_type       = "PD_HDD"
    disk_size       = 10
    disk_autoresize = true

    deletion_protection_enabled = var.protect_data

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "18:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    maintenance_window {
      day          = 7
      hour         = 19
      update_track = "stable"
    }

    user_labels = {
      application = "philobiblus"
      environment = var.environment
    }
  }

  lifecycle {
    ignore_changes = [settings[0].disk_size]
  }

  depends_on = [
    google_project_service.required,
    google_service_networking_connection.private_services,
  ]
}

resource "google_sql_database" "app" {
  name     = "philobiblus"
  instance = google_sql_database_instance.postgres.name
}
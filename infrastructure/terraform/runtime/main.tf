# Recommendation Service
data "terraform_remote_state" "foundation" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/foundation"
  }
}

locals {
  name            = "philobiblus-${var.environment}"
  allowed_origins = join(",", var.allowed_origins)
}

resource "google_cloud_run_v2_service" "recommendation" {
  name                = "${local.name}-recommendation"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = var.protect_runtime

  template {
    service_account = data.terraform_remote_state.foundation.outputs.recommendation_service_account
    timeout         = "10s"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    vpc_access {
      network_interfaces {
        network    = data.terraform_remote_state.foundation.outputs.network_id
        subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
        tags       = ["philobiblus-recommendation"]
      }
      egress = "ALL_TRAFFIC"
    }

    containers {
      image = var.recommendation_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        failure_threshold     = 12
        initial_delay_seconds = 2
        timeout_seconds       = 2
        period_seconds        = 5

        http_get {
          path = "/health"
          port = 8080
        }
      }

      liveness_probe {
        failure_threshold = 3
        timeout_seconds   = 2
        period_seconds    = 30

        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }
}

# Code hiện tại chưa gửi Google-signed ID token.
# Ingress internal vẫn chặn request trực tiếp từ Internet.
resource "google_cloud_run_v2_service_iam_member" "recommendation_internal_unauthenticated" {
  project  = var.project_id
  location = google_cloud_run_v2_service.recommendation.location
  name     = google_cloud_run_v2_service.recommendation.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Backend service
resource "google_cloud_run_v2_service" "backend" {
  name                = "${local.name}-backend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.protect_runtime

  template {
    service_account = data.terraform_remote_state.foundation.outputs.backend_service_account
    timeout         = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    vpc_access {
      network_interfaces {
        network    = data.terraform_remote_state.foundation.outputs.network_id
        subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
        tags       = ["philobiblus-backend"]
      }
      egress = "ALL_TRAFFIC"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [
          data.terraform_remote_state.foundation.outputs.sql_connection_name
        ]
      }
    }

    containers {
      image = var.backend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "APP_HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "APP_PORT"
        value = "8080"
      }

      env {
        name  = "ACCESS_TOKEN_EXPIRE_MINUTES"
        value = "1440"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = local.allowed_origins
      }

      env {
        name  = "RECOMMENDATION_SERVICE_URL"
        value = google_cloud_run_v2_service.recommendation.uri
      }

      env {
        name  = "RECOMMENDATION_TIMEOUT_SECONDS"
        value = "5"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.database_url_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.jwt_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "IMGBB_API"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.imgbb_api_secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        failure_threshold     = 20
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 5

        http_get {
          path = "/health"
          port = 8080
        }
      }

      liveness_probe {
        failure_threshold = 3
        timeout_seconds   = 3
        period_seconds    = 30

        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.recommendation_internal_unauthenticated,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Seed job
resource "google_cloud_run_v2_job" "seed" {
  name                = "${local.name}-seed"
  location            = var.region
  deletion_protection = var.protect_runtime

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = data.terraform_remote_state.foundation.outputs.seed_service_account
      timeout         = "1800s"
      max_retries     = 1

      vpc_access {
        network_interfaces {
          network    = data.terraform_remote_state.foundation.outputs.network_id
          subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
          tags       = ["philobiblus-seed"]
        }
        egress = "ALL_TRAFFIC"
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [
            data.terraform_remote_state.foundation.outputs.sql_connection_name
          ]
        }
      }

      containers {
        image   = var.backend_image
        command = ["python"]
        args    = ["-m", "scripts.seed_database"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "PYTHONPATH"
          value = "/app"
        }

        env {
          name  = "ACCESS_TOKEN_EXPIRE_MINUTES"
          value = "1440"
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = data.terraform_remote_state.foundation.outputs.database_url_secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "SECRET_KEY"
          value_source {
            secret_key_ref {
              secret  = data.terraform_remote_state.foundation.outputs.jwt_secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}
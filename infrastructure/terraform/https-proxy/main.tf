locals {
  name = "philobiblus-${var.environment}-proxy"
}

data "terraform_remote_state" "platform" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/gke-platform"
  }
}

resource "google_cloud_run_v2_service" "proxy" {
  name                = local.name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    timeout = "30s"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.proxy_image

      ports {
        container_port = 8080
      }

      env {
        name  = "BACKEND_UPSTREAM"
        value = "http://${data.terraform_remote_state.platform.outputs.gateway_ip_address}"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        failure_threshold     = 6
        initial_delay_seconds = 2
        timeout_seconds       = 2
        period_seconds        = 5
        tcp_socket {
          port = 8080
        }
      }

      liveness_probe {
        failure_threshold = 3
        period_seconds    = 10
        timeout_seconds   = 2
        http_get {
          path = "/health"
          port = 8080
        }
      }
    }

    labels = {
      application = "philobiblus"
      environment = var.environment
      component   = "https-proxy"
      managed_by  = "terraform"
    }
  }

  labels = {
    application = "philobiblus"
    environment = var.environment
    component   = "https-proxy"
    managed_by  = "terraform"
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.proxy.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

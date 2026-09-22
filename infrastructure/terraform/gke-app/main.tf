locals {
  name = "philobiblus"

  backend_image_parts        = split("@", var.backend_image)
  recommendation_image_parts = split("@", var.recommendation_image)

  backend_ksa        = "philobiblus-backend"
  recommendation_ksa = "philobiblus-recommendation"
  seed_ksa           = "philobiblus-seed"
}

data "google_project" "current" {
  project_id = var.project_id
}

data "terraform_remote_state" "foundation" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/foundation"
  }
}

data "terraform_remote_state" "platform" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/gke-platform"
  }
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.namespace

    labels = {
      "app.kubernetes.io/name"                     = "philobiblus"
      "pod-security.kubernetes.io/enforce"         = "baseline"
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/audit"           = "restricted"
      "pod-security.kubernetes.io/audit-version"   = "latest"
      "pod-security.kubernetes.io/warn"            = "restricted"
      "pod-security.kubernetes.io/warn-version"    = "latest"
    }
  }
}

resource "kubernetes_resource_quota_v1" "app" {
  metadata {
    name      = "philobiblus-quota"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "2"
      "requests.memory" = "4Gi"
      "limits.cpu"      = "4"
      "limits.memory"   = "8Gi"
      "pods"            = "20"
      "services"        = "10"
    }
  }
}

resource "kubernetes_limit_range_v1" "app" {
  metadata {
    name      = "philobiblus-defaults"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  spec {
    limit {
      type = "Container"

      default = {
        cpu    = "500m"
        memory = "512Mi"
      }

      default_request = {
        cpu    = "100m"
        memory = "128Mi"
      }
    }
  }
}

resource "kubernetes_service_account_v1" "backend" {
  metadata {
    name      = local.backend_ksa
    namespace = kubernetes_namespace_v1.app.metadata[0].name

    annotations = {
      "iam.gke.io/gcp-service-account" = data.terraform_remote_state.foundation.outputs.backend_service_account
    }
  }
}

resource "kubernetes_service_account_v1" "recommendation" {
  metadata {
    name      = local.recommendation_ksa
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "seed" {
  metadata {
    name      = local.seed_ksa
    namespace = kubernetes_namespace_v1.app.metadata[0].name

    annotations = {
      "iam.gke.io/gcp-service-account" = data.terraform_remote_state.foundation.outputs.seed_service_account
    }
  }
}

resource "google_service_account_iam_member" "backend_workload_identity" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${data.terraform_remote_state.foundation.outputs.backend_service_account}"
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.namespace}/${local.backend_ksa}]"
}

resource "google_service_account_iam_member" "seed_workload_identity" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${data.terraform_remote_state.foundation.outputs.seed_service_account}"
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.namespace}/${local.seed_ksa}]"
}

resource "helm_release" "philobiblus" {
  name      = local.name
  namespace = kubernetes_namespace_v1.app.metadata[0].name
  chart     = abspath("${path.module}/../../../kubernetes/helm/philobiblus")

  atomic          = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  timeout         = 1200

  values = [
    yamlencode({
      backend = {
        replicaCount = 1
        autoscaling = {
          enabled                        = true
          minReplicas                    = 1
          maxReplicas                    = 3
          targetCPUUtilizationPercentage = 70
        }
        image = {
          repository = local.backend_image_parts[0]
          tag        = ""
          digest     = local.backend_image_parts[1]
          pullPolicy = "IfNotPresent"
        }
        service = {
          type = "ClusterIP"
          port = 8000
        }
        bindHost       = "0.0.0.0"
        allowedOrigins = var.frontend_origin
      }
      frontend = {
        enabled = false
      }
      postgres = {
        enabled = false
      }
      recommendation = {
        enabled      = true
        replicaCount = 1
        image = {
          repository = local.recommendation_image_parts[0]
          tag        = ""
          digest     = local.recommendation_image_parts[1]
          pullPolicy = "IfNotPresent"
        }
        service = {
          port = 8080
        }
      }
      serviceAccounts = {
        backend = {
          create = false
          name   = local.backend_ksa
        }
        recommendation = {
          create = false
          name   = local.recommendation_ksa
        }
        seed = {
          create = false
          name   = local.seed_ksa
        }
      }
      externalDatabase = {
        enabled        = true
        connectionName = data.terraform_remote_state.foundation.outputs.sql_connection_name
      }
      secrets = {
        create         = false
        existingSecret = "philobiblus-secrets"
      }
      gcpSecrets = {
        enabled           = true
        includeImgbb      = var.include_imgbb_secret
        projectId         = var.project_id
        databaseUrlSecret = data.terraform_remote_state.foundation.outputs.database_url_secret_id
        jwtSecret         = data.terraform_remote_state.foundation.outputs.jwt_secret_id
        imgbbApiSecret    = data.terraform_remote_state.foundation.outputs.imgbb_api_secret_id
      }
      ingress = {
        enabled = false
      }
      gateway = {
        enabled     = true
        className   = "gke-l7-global-external-managed"
        addressName = data.terraform_remote_state.platform.outputs.gateway_address_name
        host        = var.gateway_host != "" ? var.gateway_host : try(data.terraform_remote_state.platform.outputs.api_hostname, "")
        https = {
          enabled            = var.gateway_https_enabled
          certificateMapName = var.gateway_certificate_map_name != "" ? var.gateway_certificate_map_name : try(data.terraform_remote_state.platform.outputs.api_certificate_map_name, "")
        }
        httpToHttpsRedirect = var.gateway_http_to_https_redirect
      }
      monitoring = {
        serviceMonitor = {
          enabled = false
        }
        prometheusRule = {
          enabled = false
        }
        podMonitoring = {
          enabled  = true
          interval = "30s"
        }
      }
      tests = {
        enabled = true
      }
    })
  ]

  depends_on = [
    google_service_account_iam_member.backend_workload_identity,
    google_service_account_iam_member.seed_workload_identity,
    kubernetes_limit_range_v1.app,
    kubernetes_resource_quota_v1.app,
    kubernetes_service_account_v1.backend,
    kubernetes_service_account_v1.recommendation,
    kubernetes_service_account_v1.seed,
  ]
}

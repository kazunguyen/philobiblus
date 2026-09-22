terraform {
  required_version = ">= 1.16.0, < 2.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.2"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.2"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_client_config" "current" {}

provider "kubernetes" {
  host                   = "https://${data.terraform_remote_state.platform.outputs.cluster_endpoint}"
  cluster_ca_certificate = base64decode(data.terraform_remote_state.platform.outputs.cluster_ca_certificate)
  token                  = data.google_client_config.current.access_token
}

provider "helm" {
  kubernetes = {
    host                   = "https://${data.terraform_remote_state.platform.outputs.cluster_endpoint}"
    cluster_ca_certificate = base64decode(data.terraform_remote_state.platform.outputs.cluster_ca_certificate)
    token                  = data.google_client_config.current.access_token
  }
}

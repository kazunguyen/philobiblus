# 1. GCS Bucket
resource "google_storage_bucket" "mlops_bucket" {
  name                        = "${var.project_id}-philobiblus-mlops"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning {
    enabled = false
  }
}

# 2. Cloud SQL Database & User
resource "google_sql_database" "mlflow_db" {
  name     = "mlflow"
  instance = var.sql_instance_name
}

resource "random_password" "mlflow_db_password" {
  length  = 16
  special = true
}

resource "google_sql_user" "mlflow" {
  name     = "mlflow"
  instance = var.sql_instance_name
  password = random_password.mlflow_db_password.result
}

# 3. Workload Identity & GSAs
resource "google_service_account" "trainer" {
  account_id   = "philobiblus-trainer"
  display_name = "Philobiblus Trainer GSA"
}

resource "google_service_account" "mlflow" {
  account_id   = "philobiblus-mlflow"
  display_name = "Philobiblus MLflow GSA"
}

# Assume recommendation GSA is created elsewhere, we just reference it or pass it.
# We will grant roles directly to the known recommendation GSA account ID
data "google_service_account" "recommendation" {
  account_id = "philobiblus-recommendation"
}

# IAM Bindings for Trainer
resource "google_project_iam_member" "trainer_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.trainer.email}"
}

resource "google_storage_bucket_iam_member" "trainer_storage_admin" {
  bucket = google_storage_bucket.mlops_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.trainer.email}"
}

module "trainer_workload_identity" {
  source              = "terraform-google-modules/kubernetes-engine/google//modules/workload-identity"
  version             = "~> 29.0"
  use_existing_gcp_sa = true
  name                = google_service_account.trainer.account_id
  project_id          = var.project_id
  namespace           = var.mlops_namespace
  k8s_sa_name         = "philobiblus-trainer"
}

# IAM Bindings for MLflow
resource "google_project_iam_member" "mlflow_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.mlflow.email}"
}

resource "google_storage_bucket_iam_member" "mlflow_storage_admin" {
  bucket = google_storage_bucket.mlops_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.mlflow.email}"
}

module "mlflow_workload_identity" {
  source              = "terraform-google-modules/kubernetes-engine/google//modules/workload-identity"
  version             = "~> 29.0"
  use_existing_gcp_sa = true
  name                = google_service_account.mlflow.account_id
  project_id          = var.project_id
  namespace           = var.mlops_namespace
  k8s_sa_name         = "philobiblus-mlflow"
}

# IAM Bindings for Recommendation
resource "google_storage_bucket_iam_member" "recommendation_storage_viewer" {
  bucket = google_storage_bucket.mlops_bucket.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${data.google_service_account.recommendation.email}"
}

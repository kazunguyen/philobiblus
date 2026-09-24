resource "google_storage_bucket" "mlops" {
  project                     = var.project_id
  name                        = "${var.project_id}-philobiblus-mlops"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning { enabled = true }
  lifecycle_rule {
    condition {
      age            = 90
      matches_prefix = ["snapshots/"]
    }
    action { type = "Delete" }
  }
  lifecycle_rule {
    condition { num_newer_versions = 3 }
    action { type = "Delete" }
  }
}

# Passwords and secret values are deliberately outside Terraform state. MLflow
# is isolated in the `mlflow` schema of the existing application database so
# its role can be granted only that schema without resetting the Cloud SQL
# administrator account or broadening application access.

resource "google_service_account" "trainer" {
  account_id   = "philobiblus-trainer"
  display_name = "Philobiblus MLOps trainer"
}
resource "google_service_account" "mlflow" {
  account_id   = "philobiblus-mlflow"
  display_name = "Philobiblus MLflow"
}
data "google_service_account" "recommendation" {
  account_id = var.recommendation_gsa_account_id
}

resource "google_project_iam_member" "trainer_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.trainer.email}"
}
resource "google_project_iam_member" "mlflow_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.mlflow.email}"
}
resource "google_secret_manager_secret_iam_member" "trainer_database_url" {
  project   = var.project_id
  secret_id = var.trainer_database_url_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.trainer.email}"
}
resource "google_secret_manager_secret_iam_member" "mlflow_database_url" {
  project   = var.project_id
  secret_id = var.mlflow_database_url_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.mlflow.email}"
}

resource "google_storage_bucket_iam_member" "trainer_objects" {
  bucket = google_storage_bucket.mlops.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.trainer.email}"
  condition {
    title       = "trainer-artifact-prefixes"
    description = "Snapshots and immutable model releases only"
    expression  = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.mlops.name}/objects/snapshots/') || resource.name.startsWith('projects/_/buckets/${google_storage_bucket.mlops.name}/objects/models/') || resource.name.startsWith('projects/_/buckets/${google_storage_bucket.mlops.name}/objects/releases/')"
  }
}
resource "google_storage_bucket_iam_member" "mlflow_objects" {
  bucket = google_storage_bucket.mlops.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.mlflow.email}"
  condition {
    title       = "mlflow-artifact-prefix"
    description = "MLflow artifacts only"
    expression  = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.mlops.name}/objects/mlflow/')"
  }
}
resource "google_storage_bucket_iam_member" "recommendation_models" {
  bucket = google_storage_bucket.mlops.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${data.google_service_account.recommendation.email}"
  condition {
    title       = "runtime-model-prefix"
    description = "Runtime can only read verified model objects"
    expression  = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.mlops.name}/objects/models/')"
  }
}

resource "google_service_account_iam_member" "trainer_workload_identity" {
  service_account_id = google_service_account.trainer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.mlops_namespace}/philobiblus-trainer]"
}
resource "google_service_account_iam_member" "mlflow_workload_identity" {
  service_account_id = google_service_account.mlflow.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.mlops_namespace}/philobiblus-mlflow]"
}

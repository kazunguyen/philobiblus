output "mlops_bucket_name" { value = google_storage_bucket.mlops.name }
output "trainer_gsa_email" { value = google_service_account.trainer.email }
output "mlflow_gsa_email" { value = google_service_account.mlflow.email }
output "mlflow_schema_name" { value = "mlflow" }

output "mlops_bucket_name" {
  value = google_storage_bucket.mlops_bucket.name
}

output "mlflow_db_user" {
  value = google_sql_user.mlflow.name
}

output "mlflow_db_password" {
  value     = random_password.mlflow_db_password.result
  sensitive = true
}

output "trainer_gsa_email" {
  value = google_service_account.trainer.email
}

output "mlflow_gsa_email" {
  value = google_service_account.mlflow.email
}

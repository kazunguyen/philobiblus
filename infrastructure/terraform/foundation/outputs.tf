output "network_id" {
  value = google_compute_network.main.id
}

output "subnetwork_id" {
  value = google_compute_subnetwork.run.id
}

output "sql_instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "sql_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "backend_service_account" {
  value = google_service_account.backend.email
}

output "recommendation_service_account" {
  value = google_service_account.recommendation.email
}

output "seed_service_account" {
  value = google_service_account.seed.email
}

output "artifact_registry_repository" {
  value = google_artifact_registry_repository.containers.id
}

output "database_url_secret_id" {
  value = google_secret_manager_secret.database_url.secret_id
}

output "jwt_secret_id" {
  value = google_secret_manager_secret.jwt_secret.secret_id
}

output "imgbb_api_secret_id" {
  value = google_secret_manager_secret.imgbb_api.secret_id
}
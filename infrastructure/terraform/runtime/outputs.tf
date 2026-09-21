output "backend_url" {
  description = "Public URL of the backend Cloud Run service."
  value       = google_cloud_run_v2_service.backend.uri
}

output "recommendation_url" {
  description = "Internal URL of the recommendation Cloud Run service."
  value       = google_cloud_run_v2_service.recommendation.uri
}

output "seed_job_name" {
  description = "Name of the Cloud Run Job that seeds the database."
  value       = google_cloud_run_v2_job.seed.name
}

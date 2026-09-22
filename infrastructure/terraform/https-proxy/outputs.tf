output "proxy_url" {
  description = "The HTTPS URL of the Cloud Run proxy."
  value       = google_cloud_run_v2_service.proxy.uri
}

output "api_url" {
  description = "The API base URL for frontend integration."
  value       = "${google_cloud_run_v2_service.proxy.uri}/api"
}

output "upstream_gateway_ip" {
  description = "The GKE Gateway IP upstream target."
  value       = data.terraform_remote_state.platform.outputs.gateway_ip_address
}

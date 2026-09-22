output "cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.main.name
}

output "cluster_location" {
  description = "GKE cluster region."
  value       = google_container_cluster.main.location
}

output "cluster_endpoint" {
  description = "GKE control-plane endpoint."
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Base64-encoded GKE cluster CA certificate."
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "gateway_address_name" {
  description = "Name of the static global address reserved for the GKE Gateway."
  value       = google_compute_global_address.gateway.name
}

output "gateway_ip_address" {
  description = "Static public IP reserved for the GKE Gateway."
  value       = google_compute_global_address.gateway.address
}

output "api_hostname" {
  description = "Public API hostname configured for HTTPS."
  value       = var.api_hostname
}

output "api_certificate_map_name" {
  description = "Name of the Certificate Manager certificate map."
  value       = local.https_enabled ? google_certificate_manager_certificate_map.api[0].name : ""
}

output "api_certificate_name" {
  description = "Name of the Certificate Manager certificate."
  value       = local.https_enabled ? google_certificate_manager_certificate.api[0].name : ""
}

output "api_dns_authorization_record" {
  description = "DNS CNAME authorization record for domain verification."
  value       = local.https_enabled ? google_certificate_manager_dns_authorization.api[0].dns_resource_record[0] : null
}

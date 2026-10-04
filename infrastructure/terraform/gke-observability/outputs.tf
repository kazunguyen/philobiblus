output "dashboard_id" {
  description = "Cloud Monitoring dashboard resource ID."
  value       = google_monitoring_dashboard.philobiblus.id
}

output "dashboard_url" {
  description = "Cloud Console URL for the Philobiblus GKE dashboard."
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${basename(google_monitoring_dashboard.philobiblus.id)}?project=${var.project_id}"
}

output "notification_channel_name" {
  description = "Cloud Monitoring notification channel resource name."
  value       = var.enable_alerting ? google_monitoring_notification_channel.operations[0].name : null
}

output "alert_policy_names" {
  description = "Names of the managed PromQL alert policies."
  value       = { for name, policy in google_monitoring_alert_policy.philobiblus : name => policy.name }
}

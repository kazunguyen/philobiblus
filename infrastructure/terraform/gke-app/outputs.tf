output "namespace" {
  value = kubernetes_namespace_v1.app.metadata[0].name
}

output "helm_release_name" {
  value = helm_release.philobiblus.name
}

output "gateway_ip_address" {
  value = data.terraform_remote_state.platform.outputs.gateway_ip_address
}

output "backend_http_url" {
  value = "http://${data.terraform_remote_state.platform.outputs.gateway_ip_address}"
}

#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

"$SCRIPT_DIR/25-kubeconfig.sh" >/dev/null
export PATH="$LOCAL_DIR/tools:$PATH"
export KUBECONFIG="$LOCAL_DIR/kubeconfig"

log "Waiting for Philobiblus deployments."
kubectl rollout status deployment/philobiblus-backend -n philobiblus --timeout=15m
kubectl rollout status deployment/philobiblus-recommendation -n philobiblus --timeout=15m

kubectl get pods,services,hpa,jobs -n philobiblus -o wide
kubectl get secretproviderclass,secretsync -n philobiblus
kubectl get podmonitoring -n philobiblus
kubectl get gateway,httproute,gcpbackendpolicy,networkpolicy -n philobiblus

GATEWAY_IP="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw gateway_ip_address)"
API_HOSTNAME="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw api_hostname)"

if [[ -n "$API_HOSTNAME" ]]; then
  API_CHECK_URL="https://$API_HOSTNAME/api/books/public?limit=1"
  CURL_API_CHECK=(curl -fsS --max-time 10 --resolve "$API_HOSTNAME:443:$GATEWAY_IP" "$API_CHECK_URL")
else
  API_CHECK_URL="http://$GATEWAY_IP/api/books/public?limit=1"
  CURL_API_CHECK=(curl -fsS --max-time 10 "$API_CHECK_URL")
fi

log "Waiting for the public catalogue route at $API_CHECK_URL"
for attempt in $(seq 1 40); do
  if "${CURL_API_CHECK[@]}"; then
    printf '\n'
    log "GKE public API check passed. The internal /health endpoint is deliberately not routed by Gateway."
    exit 0
  fi

  log "Gateway is not ready yet (attempt $attempt/40)."
  sleep 15
done

kubectl describe gateway philobiblus -n philobiblus || true
kubectl describe httproute philobiblus-backend -n philobiblus || true
die "Gateway did not become healthy within 10 minutes."

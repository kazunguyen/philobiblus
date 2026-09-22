#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

"$SCRIPT_DIR/25-kubeconfig.sh" >/dev/null
export KUBECONFIG="$LOCAL_DIR/kubeconfig"

log "Waiting for Philobiblus deployments."
kubectl rollout status deployment/philobiblus-backend -n philobiblus --timeout=15m
kubectl rollout status deployment/philobiblus-recommendation -n philobiblus --timeout=15m

kubectl get pods,services,hpa,jobs -n philobiblus -o wide
kubectl get secretproviderclass,secretsync -n philobiblus
kubectl get podmonitoring -n philobiblus
kubectl get gateway,httproute -n philobiblus

GATEWAY_IP="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw gateway_ip_address)"

log "Waiting for the external Gateway health path at http://$GATEWAY_IP/health"
for attempt in $(seq 1 40); do
  if curl -fsS --max-time 10 "http://$GATEWAY_IP/health"; then
    printf '\n'
    log "GKE backend health check passed."
    exit 0
  fi

  log "Gateway is not ready yet (attempt $attempt/40)."
  sleep 15
done

kubectl describe gateway philobiblus -n philobiblus || true
kubectl describe httproute philobiblus-backend -n philobiblus || true
die "Gateway did not become healthy within 10 minutes."

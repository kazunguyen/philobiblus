#!/usr/bin/env bash
#
# watch-resources.sh
# Continuously monitors the GKE cluster, Terraform states, and Kubernetes
# resources for Philobiblus according to docs/GKE_DEPLOYMENT_PLAN.md.
#

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud kubectl

INTERVAL="${WATCH_INTERVAL:-15}"
KUBECONFIG_PATH="$LOCAL_DIR/kubeconfig"
PLUGIN_PATH="$LOCAL_DIR/tools/gke-gcloud-auth-plugin"

if [[ -x "$PLUGIN_PATH" ]]; then
  export PATH="$LOCAL_DIR/tools:$PATH"
fi

export KUBECONFIG="$KUBECONFIG_PATH"

cleanup() {
  printf '\n[%s] Monitoring stopped.\n' "$(date '+%Y-%m-%d %H:%M:%S')"
}

trap cleanup EXIT SIGINT SIGTERM

ensure_kubeconfig() {
  if [[ ! -f "$KUBECONFIG_PATH" ]]; then
    bash "$SCRIPT_DIR/25-kubeconfig.sh" >/dev/null 2>&1 || true
  fi
}

check_cluster_status() {
  local cluster_name="philobiblus-dev-gke"
  local status
  status="$(gcloud container clusters describe "$cluster_name" \
    --region="$REGION" \
    --project="$(project_id)" \
    --format='value(status)' 2>/dev/null || true)"
  printf '%s' "${status:-UNKNOWN}"
}

check_terraform_state_has() {
  local dir="$1"
  local resource="$2"
  if terraform -chdir="$dir" state list 2>/dev/null | grep -Fxq "$resource"; then
    return 0
  fi
  return 1
}

is_deployment_ready() {
  local deployment_name="$1"
  local namespace="${2:-philobiblus}"
  kubectl rollout status "deployment/$deployment_name" -n "$namespace" --timeout=2s >/dev/null 2>&1
}

is_gateway_http_healthy() {
  local ip="$1"
  if [[ -z "$ip" ]]; then
    return 1
  fi
  curl -fsS --max-time 5 "http://$ip/health" >/dev/null 2>&1
}

main_loop() {
  local iteration=0
  local all_ready=false
  local cluster_st="UNKNOWN"
  local gateway_ip=""

  ensure_kubeconfig

  while [[ "$all_ready" != "true" ]]; do
    iteration=$((iteration + 1))
    printf '\033[2J\033[H' 2>/dev/null || true
    printf '%s\n' "======================================================================"
    printf ' Philobiblus GKE Deployment Watcher (Iteration #%d)\n' "$iteration"
    printf ' Timestamp: %s | Poll Interval: %ds\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$INTERVAL"
    printf '%s\n\n' "======================================================================"

    # 1. Platform & GKE Cluster
    if [[ "$cluster_st" != "RUNNING" ]]; then
      cluster_st="$(check_cluster_status)"
    fi

    if [[ -z "$gateway_ip" ]] && check_terraform_state_has "$GKE_PLATFORM_DIR" "google_compute_global_address.gateway"; then
      gateway_ip="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw gateway_ip_address 2>/dev/null || true)"
    fi

    printf '%s\n' "--- 1. Infrastructure Platform ---"
    printf ' GKE Cluster (philobiblus-dev-gke) : %s\n' "$cluster_st"
    printf ' Global Gateway Static IP          : %s\n' "${gateway_ip:-Pending}"

    local tf_platform_ok=false
    if [[ "$cluster_st" == "RUNNING" && -n "$gateway_ip" ]]; then
      tf_platform_ok=true
      printf ' Status: [READY]\n\n'
    else
      printf ' Status: [IN PROGRESS / WAITING]\n\n'
    fi

    # 2. Terraform gke-app state
    printf '%s\n' "--- 2. Terraform gke-app Layer ---"
    local has_ns=false
    local has_helm=false
    if check_terraform_state_has "$GKE_APP_DIR" "kubernetes_namespace_v1.app"; then
      has_ns=true
    fi
    if check_terraform_state_has "$GKE_APP_DIR" "helm_release.philobiblus"; then
      has_helm=true
    fi

    printf ' Namespace Resource                : %s\n' "$([ "$has_ns" = true ] && echo "Applied" || echo "Pending")"
    printf ' Helm Release (philobiblus)        : %s\n' "$([ "$has_helm" = true ] && echo "Applied" || echo "Pending")"

    local tf_app_ok=false
    if [[ "$has_ns" == "true" && "$has_helm" == "true" ]]; then
      tf_app_ok=true
      printf ' Status: [READY]\n\n'
    else
      printf ' Status: [PENDING / APPLYING]\n\n'
    fi

    # 3. Kubernetes Workloads (philobiblus namespace)
    printf '%s\n' "--- 3. Kubernetes Workloads (Namespace: philobiblus) ---"
    ensure_kubeconfig

    local backend_ready=false
    local rec_ready=false
    local seed_job_st="Not Found"
    local gateway_st="Not Found"
    local http_ready=false

    if kubectl get namespace philobiblus >/dev/null 2>&1; then
      if is_deployment_ready "philobiblus-backend"; then
        backend_ready=true
      fi
      if is_deployment_ready "philobiblus-recommendation"; then
        rec_ready=true
      fi

      seed_job_st="$(kubectl get job philobiblus-seed -n philobiblus -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || echo "Pending")"
      gateway_st="$(kubectl get gateway philobiblus -n philobiblus -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}' 2>/dev/null || echo "Pending")"

      printf ' Backend Deployment (philobiblus-backend)        : %s\n' "$([ "$backend_ready" = true ] && echo "READY" || echo "NOT READY")"
      printf ' Recommendation Deployment (philobiblus-recommend): %s\n' "$([ "$rec_ready" = true ] && echo "READY" || echo "NOT READY")"
      printf ' Seed Job Complete                               : %s\n' "${seed_job_st:-Pending}"
      printf ' Gateway Programmed                              : %s\n' "${gateway_st:-Pending}"
      printf '\n'
      printf ' Pods summary:\n'
      kubectl get pods -n philobiblus -o wide 2>/dev/null || true
      printf '\n'
      printf ' Services & Gateway:\n'
      kubectl get svc,gateway,httproute -n philobiblus 2>/dev/null || true
      printf '\n'
    else
      printf ' Namespace philobiblus does not exist yet. Waiting for gke-app deployment...\n\n'
    fi

    # 4. External Health Check
    printf '%s\n' "--- 4. Gateway External Endpoint Health Check ---"
    if is_gateway_http_healthy "$gateway_ip"; then
      http_ready=true
      printf ' Endpoint http://%s/health : [HEALTHY 200 OK]\n\n' "$gateway_ip"
    else
      printf ' Endpoint http://%s/health : [NOT HEALTHY / WAITING]\n\n' "${gateway_ip:-<No IP>}"
    fi

    # 5. Evaluation
    printf '%s\n' "--- Overall Deployment Progress ---"
    printf ' [ %s ] GKE Platform Cluster & Static IP\n' "$([ "$tf_platform_ok" = true ] && echo "X" || echo " ")"
    printf ' [ %s ] Terraform App Layer & Helm Release\n' "$([ "$tf_app_ok" = true ] && echo "X" || echo " ")"
    printf ' [ %s ] Backend Deployment Rollout\n' "$([ "$backend_ready" = true ] && echo "X" || echo " ")"
    printf ' [ %s ] Recommendation Deployment Rollout\n' "$([ "$rec_ready" = true ] && echo "X" || echo " ")"
    printf ' [ %s ] External Gateway Health (200 OK)\n' "$([ "$http_ready" = true ] && echo "X" || echo " ")"
    printf '%s\n' "======================================================================"

    if [[ "$tf_platform_ok" == "true" && "$tf_app_ok" == "true" && "$backend_ready" == "true" && "$rec_ready" == "true" && "$http_ready" == "true" ]]; then
      all_ready=true
      log "ALL TARGET RESOURCES ACCORDING TO GKE_DEPLOYMENT_PLAN.MD ARE FULLY CREATED AND HEALTHY!"
      break
    fi

    sleep "$INTERVAL"
  done
}

main_loop

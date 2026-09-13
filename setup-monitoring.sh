#!/bin/bash
# Installs the local monitoring stack, enables the Philobiblus ServiceMonitor,
# and verifies that Prometheus can scrape the backend metrics endpoint.
#
# Usage:
#   ./setup-monitoring.sh
#   APP_RELEASE=my-release ./setup-monitoring.sh
#
# The application release and its private values file must already exist. This
# script never prints or writes the secrets stored in values.local.yaml.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_CHART_PATH="${APP_CHART_PATH:-${PROJECT_ROOT}/kubernetes/helm/philobiblus}"
APP_VALUES_FILE="${APP_VALUES_FILE:-${APP_CHART_PATH}/values.local.yaml}"
APP_NAMESPACE="${APP_NAMESPACE:-philobiblus}"
APP_RELEASE="${APP_RELEASE:-philobiblus}"
BACKEND_SERVICE="${BACKEND_SERVICE:-philobiblus-backend}"
MONITORING_NAMESPACE="${MONITORING_NAMESPACE:-monitoring}"
MONITORING_RELEASE="${MONITORING_RELEASE:-monitoring}"
PROMETHEUS_LOCAL_PORT="${PROMETHEUS_LOCAL_PORT:-9091}"
HELM_TIMEOUT="${HELM_TIMEOUT:-10m}"
TARGET_WAIT_SECONDS="${TARGET_WAIT_SECONDS:-120}"
TEMP_DIRECTORY="$(mktemp -d)"
PROMETHEUS_PORT_FORWARD_PID=""

cleanup() {
  if [[ -n "${PROMETHEUS_PORT_FORWARD_PID}" ]] \
    && kill -0 "${PROMETHEUS_PORT_FORWARD_PID}" 2>/dev/null; then
    kill "${PROMETHEUS_PORT_FORWARD_PID}" 2>/dev/null || true
    wait "${PROMETHEUS_PORT_FORWARD_PID}" 2>/dev/null || true
  fi

  rm -rf "${TEMP_DIRECTORY}"
}

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${command_name}" >&2
    exit 1
  fi
}

require_file() {
  local file_path="$1"

  if [[ ! -f "${file_path}" ]]; then
    printf 'Required file was not found: %s\n' "${file_path}" >&2
    exit 1
  fi
}

wait_for_prometheus_api() {
  local attempt
  local port_forward_log="${TEMP_DIRECTORY}/prometheus-port-forward.log"

  kubectl --namespace "${MONITORING_NAMESPACE}" port-forward \
    "pod/${PROMETHEUS_POD}" "${PROMETHEUS_LOCAL_PORT}:9090" \
    >"${port_forward_log}" 2>&1 &
  PROMETHEUS_PORT_FORWARD_PID=$!

  for ((attempt = 1; attempt <= 30; attempt++)); do
    if curl --silent --show-error --fail \
      "http://127.0.0.1:${PROMETHEUS_LOCAL_PORT}/-/ready" >/dev/null; then
      return
    fi

    if ! kill -0 "${PROMETHEUS_PORT_FORWARD_PID}" 2>/dev/null; then
      cat "${port_forward_log}" >&2
      exit 1
    fi

    sleep 1
  done

  printf 'Prometheus API did not become ready through local port %s.\n' \
    "${PROMETHEUS_LOCAL_PORT}" >&2
  cat "${port_forward_log}" >&2
  exit 1
}

wait_for_backend_target() {
  local attempt
  local query_response
  local query="up{namespace=\"${APP_NAMESPACE}\",service=\"${BACKEND_SERVICE}\"}"
  local maximum_attempts=$((TARGET_WAIT_SECONDS / 5))

  for ((attempt = 1; attempt <= maximum_attempts; attempt++)); do
    query_response="$(curl --silent --show-error --fail --get \
      --data-urlencode "query=${query}" \
      "http://127.0.0.1:${PROMETHEUS_LOCAL_PORT}/api/v1/query")"

    if printf '%s' "${query_response}" | grep -Eq '"value":\[[^]]+,"1"\]'; then
      printf 'Prometheus target is UP for service %s in namespace %s.\n' \
        "${BACKEND_SERVICE}" "${APP_NAMESPACE}"
      return
    fi

    sleep 5
  done

  printf 'Prometheus did not report an UP target for service %s in namespace %s.\n' \
    "${BACKEND_SERVICE}" "${APP_NAMESPACE}" >&2
  printf 'Inspect targets at http://127.0.0.1:%s/targets before this script exits.\n' \
    "${PROMETHEUS_LOCAL_PORT}" >&2
  exit 1
}

trap cleanup EXIT

for command_name in curl helm kubectl grep; do
  require_command "${command_name}"
done

require_file "${APP_VALUES_FILE}"
require_file "${APP_CHART_PATH}/Chart.yaml"

if ! kubectl cluster-info >/dev/null 2>&1; then
  printf 'kubectl cannot reach the current Kubernetes cluster.\n' >&2
  exit 1
fi

if ! helm status "${APP_RELEASE}" --namespace "${APP_NAMESPACE}" >/dev/null 2>&1; then
  printf 'Helm release %s was not found in namespace %s.\n' \
    "${APP_RELEASE}" "${APP_NAMESPACE}" >&2
  printf 'Deploy Philobiblus first, or override APP_RELEASE and APP_NAMESPACE.\n' >&2
  exit 1
fi

helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts \
  --force-update >/dev/null
helm repo update prometheus-community

# The application ServiceMonitor has no release=monitoring label. Selecting all
# ServiceMonitors is acceptable for the single-user local k3d demonstration.
helm upgrade --install "${MONITORING_RELEASE}" \
  prometheus-community/kube-prometheus-stack \
  --namespace "${MONITORING_NAMESPACE}" \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --wait \
  --timeout "${HELM_TIMEOUT}"

kubectl wait --for=condition=Established \
  --timeout="${HELM_TIMEOUT}" \
  crd/servicemonitors.monitoring.coreos.com

helm lint "${APP_CHART_PATH}" --values "${APP_VALUES_FILE}"
helm upgrade "${APP_RELEASE}" "${APP_CHART_PATH}" \
  --namespace "${APP_NAMESPACE}" \
  --values "${APP_VALUES_FILE}" \
  --set monitoring.serviceMonitor.enabled=true \
  --wait \
  --wait-for-jobs \
  --timeout "${HELM_TIMEOUT}"

kubectl rollout status "deployment/${APP_RELEASE}-backend" \
  --namespace "${APP_NAMESPACE}" \
  --timeout="${HELM_TIMEOUT}"

if ! kubectl get service "${BACKEND_SERVICE}" --namespace "${APP_NAMESPACE}" \
  >/dev/null; then
  printf 'Backend service %s was not found in namespace %s.\n' \
    "${BACKEND_SERVICE}" "${APP_NAMESPACE}" >&2
  exit 1
fi

if ! kubectl get servicemonitor --namespace "${APP_NAMESPACE}" \
  --output name | grep -q .; then
  printf 'No ServiceMonitor was created in namespace %s.\n' \
    "${APP_NAMESPACE}" >&2
  exit 1
fi

PROMETHEUS_POD="$(kubectl get pods --namespace "${MONITORING_NAMESPACE}" \
  --selector app.kubernetes.io/name=prometheus \
  --field-selector=status.phase=Running \
  --output jsonpath='{.items[0].metadata.name}')"

if [[ -z "${PROMETHEUS_POD}" ]]; then
  printf 'No running Prometheus pod was found in namespace %s.\n' \
    "${MONITORING_NAMESPACE}" >&2
  exit 1
fi

wait_for_prometheus_api
wait_for_backend_target

printf '\nMonitoring setup completed successfully.\n'
kubectl get pods --namespace "${MONITORING_NAMESPACE}"
kubectl get servicemonitor --namespace "${APP_NAMESPACE}"

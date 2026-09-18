#!/usr/bin/env bash
# Open local access to the Grafana and Prometheus Services in a monitoring stack.
#
# Usage:
#   bash ./scripts/expose-monitoring.sh
#   GRAFANA_LOCAL_PORT=3300 PROMETHEUS_LOCAL_PORT=9191 \
#     bash ./scripts/expose-monitoring.sh
#
# The script discovers each Service's installed Service port, starts both
# port-forwards, verifies their health endpoints, then keeps them open until
# it receives Ctrl+C. It does not print monitoring credentials.

set -Eeuo pipefail

MONITORING_NAMESPACE="${MONITORING_NAMESPACE:-monitoring}"
GRAFANA_SERVICE="${GRAFANA_SERVICE:-monitoring-grafana}"
PROMETHEUS_SERVICE="${PROMETHEUS_SERVICE:-monitoring-kube-prometheus-prometheus}"
GRAFANA_LOCAL_PORT="${GRAFANA_LOCAL_PORT:-3000}"
PROMETHEUS_LOCAL_PORT="${PROMETHEUS_LOCAL_PORT:-9090}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-30}"
TEMP_DIRECTORY="$(mktemp -d)"
declare -a PORT_FORWARD_PIDS=()

cleanup() {
  local process_id

  for process_id in "${PORT_FORWARD_PIDS[@]:-}"; do
    if kill -0 "${process_id}" 2>/dev/null; then
      kill "${process_id}" 2>/dev/null || true
      wait "${process_id}" 2>/dev/null || true
    fi
  done

  rm -rf "${TEMP_DIRECTORY}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_service() {
  local service_name="$1"

  if ! kubectl --namespace "${MONITORING_NAMESPACE}" get service "${service_name}" >/dev/null; then
    printf 'Service %s was not found in namespace %s.\n' \
      "${service_name}" "${MONITORING_NAMESPACE}" >&2
    exit 1
  fi
}

service_port() {
  local service_name="$1"
  local port

  port="$(kubectl --namespace "${MONITORING_NAMESPACE}" get service "${service_name}" \
    --output jsonpath='{.spec.ports[0].port}')"

  if [[ ! "${port}" =~ ^[0-9]+$ ]]; then
    printf 'Could not determine a Service port for %s.\n' "${service_name}" >&2
    exit 1
  fi

  printf '%s\n' "${port}"
}

wait_for_endpoint() {
  local name="$1"
  local process_id="$2"
  local url="$3"
  local log_file="$4"
  local attempt

  for ((attempt = 1; attempt <= READY_TIMEOUT_SECONDS; attempt++)); do
    # A refused connection is expected until kubectl opens the local socket.
    # The script reports the port-forward log only after a real timeout/failure.
    if curl --silent --fail --max-time 2 "${url}" >/dev/null; then
      return
    fi

    if ! kill -0 "${process_id}" 2>/dev/null; then
      printf '%s port-forward stopped before its health endpoint became ready.\n' \
        "${name}" >&2
      cat "${log_file}" >&2
      exit 1
    fi

    sleep 1
  done

  printf '%s did not become ready through %s within %s seconds.\n' \
    "${name}" "${url}" "${READY_TIMEOUT_SECONDS}" >&2
  cat "${log_file}" >&2
  exit 1
}

start_port_forward() {
  local name="$1"
  local service_name="$2"
  local local_port="$3"
  local remote_port="$4"
  local health_url="$5"
  local log_file="${TEMP_DIRECTORY}/${name,,}-port-forward.log"
  local process_id

  kubectl --namespace "${MONITORING_NAMESPACE}" port-forward \
    "service/${service_name}" "${local_port}:${remote_port}" \
    >"${log_file}" 2>&1 &
  process_id=$!
  PORT_FORWARD_PIDS+=("${process_id}")

  wait_for_endpoint "${name}" "${process_id}" "${health_url}" "${log_file}"
}

for command_name in curl kubectl; do
  require_command "${command_name}"
done

if ! kubectl cluster-info >/dev/null 2>&1; then
  printf 'kubectl cannot reach the current Kubernetes cluster.\n' >&2
  exit 1
fi

require_service "${GRAFANA_SERVICE}"
require_service "${PROMETHEUS_SERVICE}"

GRAFANA_SERVICE_PORT="$(service_port "${GRAFANA_SERVICE}")"
PROMETHEUS_SERVICE_PORT="$(service_port "${PROMETHEUS_SERVICE}")"
GRAFANA_URL="http://127.0.0.1:${GRAFANA_LOCAL_PORT}"
PROMETHEUS_URL="http://127.0.0.1:${PROMETHEUS_LOCAL_PORT}"

start_port_forward "Grafana" "${GRAFANA_SERVICE}" "${GRAFANA_LOCAL_PORT}" \
  "${GRAFANA_SERVICE_PORT}" "${GRAFANA_URL}/api/health"
start_port_forward "Prometheus" "${PROMETHEUS_SERVICE}" "${PROMETHEUS_LOCAL_PORT}" \
  "${PROMETHEUS_SERVICE_PORT}" "${PROMETHEUS_URL}/-/ready"

cat <<EOF
Monitoring services are available locally:

  Grafana:    ${GRAFANA_URL}
  Prometheus: ${PROMETHEUS_URL}

To display Grafana from a locally built frontend, build it with:
  VITE_GRAFANA_URL=${GRAFANA_URL} npm run build

Press Ctrl+C to stop both port-forwards.
EOF

wait "${PORT_FORWARD_PIDS[@]}"

#!/usr/bin/env bash
# Generate in-cluster HTTP load and demonstrate HPA scale-up one replica at a time.
#
# Usage:
#   ./scripts/stress-backend-hpa.sh
#   NAMESPACE=demo HPA=my-backend-hpa SERVICE=my-backend ./scripts/stress-backend-hpa.sh
#
# The script expects a Metrics Server and an HPA configured with minReplicas=3,
# maxReplicas>=6, and a CPU resource metric. It creates only a temporary load pod.

set -Eeuo pipefail

NAMESPACE="${NAMESPACE:-philobiblus}"
HPA="${HPA:-philobiblus-backend-hpa}"
DEPLOYMENT="${DEPLOYMENT:-philobiblus-backend}"
SERVICE="${SERVICE:-philobiblus-backend}"
SERVICE_PORT="${SERVICE_PORT:-8000}"
TARGET_PATH="${TARGET_PATH:-/health}"
LOAD_IMAGE="${LOAD_IMAGE:-busybox:1.36.1}"
WORKERS="${WORKERS:-100}"
STEP_PERIOD_SECONDS="${STEP_PERIOD_SECONDS:-60}"
POLL_SECONDS="${POLL_SECONDS:-10}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-480}"
OBSERVE_SECONDS="${OBSERVE_SECONDS:-20}"
STRESS_POD="${STRESS_POD:-backend-hpa-load-${RANDOM}}"

LOAD_STARTED=false
ORIGINAL_SCALE_UP=""

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_positive_integer() {
  case "$2" in
    ''|*[!0-9]*)
      printf '%s must be a positive integer; got %s.\n' "$1" "$2" >&2
      exit 1
      ;;
  esac

  if (( $2 < 1 )); then
    printf '%s must be greater than zero; got %s.\n' "$1" "$2" >&2
    exit 1
  fi
}

capture_original_scale_up() {
  local stabilization_window select_policy policies
  local policies_json="" policy_type policy_value policy_period policy_json

  stabilization_window="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" \
    -o jsonpath='{.spec.behavior.scaleUp.stabilizationWindowSeconds}')"
  select_policy="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" \
    -o jsonpath='{.spec.behavior.scaleUp.selectPolicy}')"
  policies="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" \
    -o jsonpath='{range .spec.behavior.scaleUp.policies[*]}{.type}{"\t"}{.value}{"\t"}{.periodSeconds}{"\n"}{end}')"

  case "${stabilization_window}" in
    ''|*[!0-9]*)
      printf 'Could not read HPA scaleUp.stabilizationWindowSeconds.\n' >&2
      return 1
      ;;
  esac

  case "${select_policy}" in
    ''|Max|Min|Disabled) ;;
    *)
      printf 'Unsupported HPA scaleUp.selectPolicy: %s.\n' "${select_policy}" >&2
      return 1
      ;;
  esac

  while IFS=$'\t' read -r policy_type policy_value policy_period; do
    [[ -z "${policy_type}" ]] && continue

    case "${policy_type}" in
      Pods|Percent) ;;
      *)
        printf 'Unsupported HPA scale-up policy type: %s.\n' "${policy_type}" >&2
        return 1
        ;;
    esac
    case "${policy_value}" in
      ''|*[!0-9]*)
        printf 'Invalid HPA scale-up policy value: %s.\n' "${policy_value}" >&2
        return 1
        ;;
    esac
    case "${policy_period}" in
      ''|*[!0-9]*)
        printf 'Invalid HPA scale-up policy period: %s.\n' "${policy_period}" >&2
        return 1
        ;;
    esac

    policy_json="{\"type\":\"${policy_type}\",\"value\":${policy_value},\"periodSeconds\":${policy_period}}"
    if [[ -n "${policies_json}" ]]; then
      policies_json+=","
    fi
    policies_json+="${policy_json}"
  done <<< "${policies}"

  if [[ -z "${policies_json}" ]]; then
    printf 'Could not read any HPA scale-up policies.\n' >&2
    return 1
  fi

  printf '{"stabilizationWindowSeconds":%s,"policies":[%s]' \
    "${stabilization_window}" "${policies_json}"
  if [[ -n "${select_policy}" ]]; then
    printf ',"selectPolicy":"%s"' "${select_policy}"
  else
    # A null value removes selectPolicy added by this script during restoration.
    printf ',"selectPolicy":null'
  fi
  printf '}'
}

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM
  set +e

  if [[ "${LOAD_STARTED}" == "true" ]]; then
    printf '\nRemoving temporary load pod %s...\n' "${STRESS_POD}"
    kubectl -n "${NAMESPACE}" delete pod "${STRESS_POD}" \
      --ignore-not-found --wait=false >/dev/null
  fi

  if [[ -n "${ORIGINAL_SCALE_UP}" ]]; then
    printf 'Restoring the original HPA scale-up behavior...\n'
    kubectl -n "${NAMESPACE}" patch hpa "${HPA}" --type=merge \
      --patch "{\"spec\":{\"behavior\":{\"scaleUp\":${ORIGINAL_SCALE_UP}}}}" >/dev/null
  fi

  exit "${exit_code}"
}

print_status() {
  kubectl -n "${NAMESPACE}" get hpa "${HPA}" \
    -o custom-columns='NAME:.metadata.name,REPLICAS:.status.currentReplicas,CPU:.status.currentMetrics[0].resource.current.averageUtilization,TARGET:.spec.metrics[0].resource.target.averageUtilization' \
    --no-headers || true
  kubectl -n "${NAMESPACE}" get deployment "${DEPLOYMENT}" \
    -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas' \
    --no-headers || true
}

wait_for_replicas() {
  local expected="$1"
  local deadline=$((SECONDS + MAX_WAIT_SECONDS))
  local current ready

  printf '\nWaiting for %s backend replicas...\n' "${expected}"

  while true; do
    current="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" -o jsonpath='{.status.currentReplicas}')"
    ready="$(kubectl -n "${NAMESPACE}" get deployment "${DEPLOYMENT}" -o jsonpath='{.status.readyReplicas}')"
    current="${current:-0}"
    ready="${ready:-0}"

    printf '  HPA replicas: %s; ready backend pods: %s\n' "${current}" "${ready}"

    if (( current == expected && ready >= expected )); then
      printf 'Reached %s replicas.\n' "${expected}"
      print_status
      return 0
    fi

    if (( current > expected )); then
      printf 'HPA reached %s replicas before the expected %s. Check whether another process changed the HPA.\n' \
        "${current}" "${expected}" >&2
      return 1
    fi

    if (( SECONDS >= deadline )); then
      printf 'Timed out after %s seconds waiting for %s replicas.\n' \
        "${MAX_WAIT_SECONDS}" "${expected}" >&2
      kubectl -n "${NAMESPACE}" describe hpa "${HPA}" >&2 || true
      return 1
    fi

    sleep "${POLL_SECONDS}"
  done
}

require_command kubectl
require_positive_integer WORKERS "${WORKERS}"
require_positive_integer STEP_PERIOD_SECONDS "${STEP_PERIOD_SECONDS}"
require_positive_integer POLL_SECONDS "${POLL_SECONDS}"
require_positive_integer MAX_WAIT_SECONDS "${MAX_WAIT_SECONDS}"
require_positive_integer OBSERVE_SECONDS "${OBSERVE_SECONDS}"

if [[ "${TARGET_PATH}" != /* ]]; then
  TARGET_PATH="/${TARGET_PATH}"
fi

kubectl -n "${NAMESPACE}" get hpa "${HPA}" >/dev/null
kubectl -n "${NAMESPACE}" get deployment "${DEPLOYMENT}" >/dev/null
kubectl -n "${NAMESPACE}" get service "${SERVICE}" >/dev/null

MIN_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" -o jsonpath='{.spec.minReplicas}')"
MAX_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" -o jsonpath='{.spec.maxReplicas}')"
SCALING_ACTIVE="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}')"
CURRENT_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa "${HPA}" -o jsonpath='{.status.currentReplicas}')"
READY_REPLICAS="$(kubectl -n "${NAMESPACE}" get deployment "${DEPLOYMENT}" -o jsonpath='{.status.readyReplicas}')"

if [[ "${MIN_REPLICAS}" != "3" || "${MAX_REPLICAS}" -lt 6 ]]; then
  printf 'HPA %s must use minReplicas=3 and maxReplicas>=6; found min=%s, max=%s.\n' \
    "${HPA}" "${MIN_REPLICAS}" "${MAX_REPLICAS}" >&2
  exit 1
fi

if [[ "${SCALING_ACTIVE}" != "True" ]]; then
  printf 'HPA %s is not actively receiving CPU metrics. Confirm Metrics Server is healthy, then run kubectl describe hpa %s -n %s.\n' \
    "${HPA}" "${HPA}" "${NAMESPACE}" >&2
  exit 1
fi

if [[ "${CURRENT_REPLICAS:-0}" != "3" || "${READY_REPLICAS:-0}" != "3" ]]; then
  printf 'The test must start with exactly 3 ready backend replicas; current HPA=%s, ready=%s. Wait for scale-down before rerunning.\n' \
    "${CURRENT_REPLICAS:-0}" "${READY_REPLICAS:-0}" >&2
  exit 1
fi

# JSONPath is supported by older kubectl clients, unlike the optional toJson helper.
ORIGINAL_SCALE_UP="$(capture_original_scale_up)"
if [[ "${ORIGINAL_SCALE_UP}" != \{* ]]; then
  printf 'Could not read the existing HPA scale-up behavior as JSON.\n' >&2
  exit 1
fi

trap cleanup EXIT
trap 'exit 130' INT TERM

STEPWISE_SCALE_UP_PATCH="$(printf '{\"spec\":{\"behavior\":{\"scaleUp\":{\"stabilizationWindowSeconds\":0,\"selectPolicy\":\"Max\",\"policies\":[{\"type\":\"Pods\",\"value\":1,\"periodSeconds\":%s}]}}}}' "${STEP_PERIOD_SECONDS}")"

printf 'Applying a temporary HPA scale-up limit: one pod every %s seconds.\n' "${STEP_PERIOD_SECONDS}"
kubectl -n "${NAMESPACE}" patch hpa "${HPA}" --type=merge --patch "${STEPWISE_SCALE_UP_PATCH}" >/dev/null

SERVICE_URL="http://${SERVICE}:${SERVICE_PORT}${TARGET_PATH}"
printf 'Starting %s HTTP workers against %s from temporary pod %s.\n' \
  "${WORKERS}" "${SERVICE_URL}" "${STRESS_POD}"
kubectl -n "${NAMESPACE}" run "${STRESS_POD}" \
  --image="${LOAD_IMAGE}" \
  --restart=Never \
  --labels='app.kubernetes.io/name=backend-hpa-load,app.kubernetes.io/component=load-test' \
  --command -- sh -c '
url="$1"
workers="$2"
i=1
while [ "$i" -le "$workers" ]; do
  (
    while true; do
      wget -q -T 5 -O /dev/null "$url" || true
    done
  ) &
  i=$((i + 1))
done
wait
' sh "${SERVICE_URL}" "${WORKERS}" >/dev/null
LOAD_STARTED=true

kubectl -n "${NAMESPACE}" wait --for=condition=Ready "pod/${STRESS_POD}" --timeout=90s

printf '\nInitial state:\n'
print_status

for expected in 4 5 6; do
  wait_for_replicas "${expected}"
  printf 'Keeping the load for %s more seconds so this level is observable.\n' "${OBSERVE_SECONDS}"
  sleep "${OBSERVE_SECONDS}"
done

printf '\nCompleted: HPA scaled 3 -> 4 -> 5 -> 6 without a direct jump.\n'
printf 'Load generation will now stop; the existing HPA scale-down policy controls the return to 3 replicas.\n'

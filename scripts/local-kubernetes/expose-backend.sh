#!/usr/bin/env bash
# Expose the Kubernetes backend through a Cloudflare Quick Tunnel running in-cluster.
#
# Usage:
#   bash scripts/local-kubernetes/expose-backend.sh
#   PAGES_ORIGIN=https://<github-user>.github.io bash scripts/local-kubernetes/expose-backend.sh
#
# This creates one temporary pod in the target namespace and attaches to its logs.
# The pod is removed automatically when this script is stopped with Ctrl+C.

set -Eeuo pipefail

NAMESPACE="${NAMESPACE:-philobiblus}"
SERVICE="${SERVICE:-philobiblus-backend}"
SERVICE_PORT="${SERVICE_PORT:-8000}"
BACKEND_DEPLOYMENT="${BACKEND_DEPLOYMENT:-philobiblus-backend}"
PAGES_ORIGIN="${PAGES_ORIGIN:-https://kazunguyen.github.io}"
CLOUDFLARED_IMAGE="${CLOUDFLARED_IMAGE:-cloudflare/cloudflared:latest}"
POD_NAME="${POD_NAME:-philobiblus-cloudflared-quick-${RANDOM}}"
SERVICE_URL="http://${SERVICE}.${NAMESPACE}.svc.cluster.local:${SERVICE_PORT}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

for command in kubectl grep; do
  require_command "${command}"
done

if ! kubectl -n "${NAMESPACE}" get service "${SERVICE}" >/dev/null; then
  printf 'Service %s was not found in namespace %s.\n' "${SERVICE}" "${NAMESPACE}" >&2
  exit 1
fi

SERVICE_PORTS="$(kubectl -n "${NAMESPACE}" get service "${SERVICE}" \
  -o jsonpath='{range .spec.ports[*]}{.port}{"\n"}{end}')"
if ! printf '%s\n' "${SERVICE_PORTS}" | grep -Fxq "${SERVICE_PORT}"; then
  printf 'Service %s does not expose port %s. Available ports: %s\n' \
    "${SERVICE}" "${SERVICE_PORT}" "${SERVICE_PORTS//$'\n'/, }" >&2
  exit 1
fi

ALLOWED_ORIGINS="$(kubectl -n "${NAMESPACE}" get deployment "${BACKEND_DEPLOYMENT}" \
  -o jsonpath='{range .spec.template.spec.containers[?(@.name=="backend")].env[?(@.name=="ALLOWED_ORIGINS")]}{.value}{end}' \
  2>/dev/null || true)"
if [[ -z "${ALLOWED_ORIGINS}" ]]; then
  printf 'Could not read ALLOWED_ORIGINS from deployment %s; verify CORS manually.\n' \
    "${BACKEND_DEPLOYMENT}" >&2
elif ! printf ',%s,\n' "${ALLOWED_ORIGINS}" | grep -Fq ",${PAGES_ORIGIN},"; then
  printf 'CORS does not allow %s. Current ALLOWED_ORIGINS: %s\n' \
    "${PAGES_ORIGIN}" "${ALLOWED_ORIGINS}" >&2
  exit 1
fi

cat <<EOF
Starting temporary Cloudflare Quick Tunnel inside namespace ${NAMESPACE}.

Tunnel origin: ${SERVICE_URL}
Tunnel pod:    ${POD_NAME}

Cloudflare will print a URL similar to:
  https://random-name.trycloudflare.com

Set GitHub repository variable VITE_API_URL to that URL followed by /api:
  https://random-name.trycloudflare.com/api

The FastAPI backend serves routes under /api, while the frontend app appends
/auth, /books, and other resource paths itself.

Security note: the Quick Tunnel is public and temporary. It is suitable only
for the internship demo and exposes every backend route, including /metrics.
Stop this script with Ctrl+C when the demo ends; the temporary pod is removed.

EOF

kubectl -n "${NAMESPACE}" run "${POD_NAME}" \
  --rm \
  --stdin \
  --tty \
  --restart=Never \
  --image="${CLOUDFLARED_IMAGE}" \
  --labels='app.kubernetes.io/name=cloudflared,app.kubernetes.io/component=tunnel' \
  -- tunnel --url "${SERVICE_URL}"

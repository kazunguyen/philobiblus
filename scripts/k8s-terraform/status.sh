#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

printf '\nGKE platform Terraform state\n'
terraform -chdir="$GKE_PLATFORM_DIR" state list 2>/dev/null || true

printf '\nGKE platform outputs\n'
terraform -chdir="$GKE_PLATFORM_DIR" output 2>/dev/null || true

if [[ -f "$LOCAL_DIR/kubeconfig" ]]; then
  "$SCRIPT_DIR/25-kubeconfig.sh" >/dev/null
  printf '\nKubernetes resources\n'
  KUBECONFIG="$LOCAL_DIR/kubeconfig" kubectl get all -n philobiblus 2>/dev/null || true
  KUBECONFIG="$LOCAL_DIR/kubeconfig" kubectl get gateway,httproute -n philobiblus 2>/dev/null || true
fi

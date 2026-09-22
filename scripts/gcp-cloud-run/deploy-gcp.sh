#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/../gcp-shared/gcp-prerequisites.sh"
bash "$SCRIPT_DIR/terraform-configure.sh"
bash "$SCRIPT_DIR/../gcp-shared/terraform-apply.sh"
bash "$SCRIPT_DIR/../gcp-shared/dockerhub-build-push.sh"
bash "$SCRIPT_DIR/../gcp-shared/terraform-secrets-apply.sh"
bash "$SCRIPT_DIR/terraform-runtime-apply.sh"
bash "$SCRIPT_DIR/terraform-seed-and-verify.sh"

RUNTIME_DIR="$SCRIPT_DIR/../../infrastructure/terraform/runtime"
BACKEND_URL="$(terraform -chdir="$RUNTIME_DIR" output -raw backend_url)"

printf '\nSet this GitHub Pages variable manually:\n\n'
printf 'VITE_API_URL=%s/api\n' "$BACKEND_URL"

#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands terraform gcloud

RUNTIME_DIR="$(runtime_dir)"
STATE_BUCKET_NAME="$(runtime_state_bucket)"
PLAN_FILE="$(mktemp "${TMPDIR:-/tmp}/philobiblus-runtime-destroy.XXXXXX")"
trap 'rm -f -- "$PLAN_FILE"' EXIT

runtime_init
terraform -chdir="$RUNTIME_DIR" plan -destroy \
  -input=false \
  -var='protect_runtime=false' \
  -out="$PLAN_FILE"
terraform -chdir="$RUNTIME_DIR" apply -input=false "$PLAN_FILE"

if [[ -n "$(terraform -chdir="$RUNTIME_DIR" state list)" ]]; then
  echo "Runtime state still has managed resources; refusing to remove remote state." >&2
  exit 1
fi

gcloud storage rm "gs://$STATE_BUCKET_NAME/philobiblus/runtime/default.tfstate" || true

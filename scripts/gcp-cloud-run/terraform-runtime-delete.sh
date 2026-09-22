#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../gcp-shared/lib/deploy-common.sh"

require_commands terraform gcloud

RUNTIME_DIR="$(runtime_dir)"
STATE_BUCKET_NAME="$(runtime_state_bucket)"
UNPROTECT_PLAN_FILE="$(mktemp "${TMPDIR:-/tmp}/philobiblus-runtime-unprotect.XXXXXX")"
DESTROY_PLAN_FILE="$(mktemp "${TMPDIR:-/tmp}/philobiblus-runtime-destroy.XXXXXX")"
trap 'rm -f -- "$UNPROTECT_PLAN_FILE" "$DESTROY_PLAN_FILE"' EXIT

runtime_init

RUNTIME_STATE="$(terraform -chdir="$RUNTIME_DIR" state list)"
UNPROTECT_TARGETS=()
for address in \
  google_cloud_run_v2_service.backend \
  google_cloud_run_v2_service.recommendation \
  google_cloud_run_v2_job.seed; do
  if grep -Fxq "$address" <<<"$RUNTIME_STATE"; then
    UNPROTECT_TARGETS+=("-target=$address")
  fi
done

if ((${#UNPROTECT_TARGETS[@]})); then
  terraform -chdir="$RUNTIME_DIR" plan \
    -input=false \
    -var='protect_runtime=false' \
    "${UNPROTECT_TARGETS[@]}" \
    -out="$UNPROTECT_PLAN_FILE"
  terraform -chdir="$RUNTIME_DIR" apply -input=false "$UNPROTECT_PLAN_FILE"
fi

terraform -chdir="$RUNTIME_DIR" plan -destroy \
  -input=false \
  -var='protect_runtime=false' \
  -out="$DESTROY_PLAN_FILE"
terraform -chdir="$RUNTIME_DIR" apply -input=false "$DESTROY_PLAN_FILE"

REMAINING_MANAGED_RESOURCES="$(terraform -chdir="$RUNTIME_DIR" state list | grep -v '^data\.' || true)"
if [[ -n "$REMAINING_MANAGED_RESOURCES" ]]; then
  echo "Runtime state still has managed resources; refusing to remove remote state." >&2
  printf '%s\n' "$REMAINING_MANAGED_RESOURCES" >&2
  exit 1
fi

gcloud storage rm "gs://$STATE_BUCKET_NAME/philobiblus/runtime/default.tfstate" || true

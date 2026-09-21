#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands terraform gcloud

RUNTIME_DIR="$(runtime_dir)"
PLAN_FILE="$(mktemp "${TMPDIR:-/tmp}/philobiblus-runtime-apply.XXXXXX")"
trap 'rm -f -- "$PLAN_FILE"' EXIT

[[ -f "$RUNTIME_DIR/terraform.tfvars" ]] || {
  echo "Missing $RUNTIME_DIR/terraform.tfvars. Run scripts/terraform-configure.sh first." >&2
  exit 1
}

if ! grep -Eq '^[[:space:]]*backend_image[[:space:]]*=' "$RUNTIME_DIR/terraform.tfvars" && \
   [[ ! -f "$RUNTIME_DIR/images.auto.tfvars" ]]; then
  echo "Missing runtime image references. Run scripts/dockerhub-build-push.sh first." >&2
  exit 1
fi

gcloud auth application-default print-access-token >/dev/null
runtime_init
terraform -chdir="$RUNTIME_DIR" fmt -check -recursive
terraform -chdir="$RUNTIME_DIR" validate
terraform -chdir="$RUNTIME_DIR" plan -input=false -out="$PLAN_FILE"
terraform -chdir="$RUNTIME_DIR" apply -input=false "$PLAN_FILE"
terraform -chdir="$RUNTIME_DIR" output

#!/usr/bin/env bash

set -Eeuo pipefail

# Non-interactive WSL sessions do not always load the profile that adds Snap
# executables to PATH. Keep every script usable from both WSL and PowerShell.
if [[ -d /snap/bin ]]; then
  export PATH="/snap/bin:$PATH"
fi

K8S_TERRAFORM_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$K8S_TERRAFORM_SCRIPT_DIR/../.." && pwd)"
FOUNDATION_DIR="$PROJECT_ROOT/infrastructure/terraform/foundation"
RUNTIME_DIR="$PROJECT_ROOT/infrastructure/terraform/runtime"
BOOTSTRAP_DIR="$PROJECT_ROOT/infrastructure/terraform/bootstrap"
GKE_PLATFORM_DIR="$PROJECT_ROOT/infrastructure/terraform/gke-platform"
GKE_APP_DIR="$PROJECT_ROOT/infrastructure/terraform/gke-app"
LOCAL_DIR="$K8S_TERRAFORM_SCRIPT_DIR/.local"

REGION="${REGION:-asia-southeast1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

if [[ -x "$LOCAL_DIR/tools/gke-gcloud-auth-plugin" ]]; then
  export PATH="$LOCAL_DIR/tools:$PATH"
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_commands() {
  local command_name

  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 || die "Missing command: $command_name"
  done
}

read_tfvar_string() {
  local file_path="$1"
  local variable_name="$2"
  local value

  value="$(sed -nE "s/^[[:space:]]*${variable_name}[[:space:]]*=[[:space:]]*\"([^\"]+)\".*/\1/p" "$file_path" | head -n 1)"
  [[ -n "$value" ]] || die "Could not read $variable_name from $file_path"
  printf '%s\n' "$value"
}

read_tfvar_list_first_string() {
  local file_path="$1"
  local variable_name="$2"
  local value

  value="$(sed -nE "/^[[:space:]]*${variable_name}[[:space:]]*=/,/^[[:space:]]*]/s/^[[:space:]]*\"([^\"]+)\"[,]?[[:space:]]*$/\1/p" "$file_path" | head -n 1)"
  [[ -n "$value" ]] || die "Could not read the first $variable_name entry from $file_path"
  printf '%s\n' "$value"
}

project_id() {
  local value="${PROJECT_ID:-}"

  if [[ -z "$value" && -f "$FOUNDATION_DIR/terraform.tfvars" ]]; then
    value="$(read_tfvar_string "$FOUNDATION_DIR/terraform.tfvars" project_id)"
  fi

  if [[ -z "$value" ]]; then
    value="$(gcloud config get-value project 2>/dev/null)"
  fi

  [[ -n "$value" && "$value" != "(unset)" ]] || die "Set PROJECT_ID or configure gcloud core/project."
  printf '%s\n' "$value"
}

state_bucket_name() {
  read_tfvar_string "$BOOTSTRAP_DIR/terraform.tfvars" state_bucket_name
}

terraform_init() {
  local directory="$1"
  local bucket="$2"

  terraform -chdir="$directory" init -input=false -reconfigure -backend-config="bucket=$bucket"
}

terraform_plan_apply() {
  local directory="$1"
  local plan_name="$2"

  terraform -chdir="$directory" fmt -check -recursive
  terraform -chdir="$directory" validate
  terraform -chdir="$directory" plan -input=false -out="$plan_name"
  terraform -chdir="$directory" apply -input=false "$plan_name"
}

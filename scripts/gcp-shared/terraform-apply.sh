#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_DIR="${SCRIPT_DIR}/../../infrastructure/terraform/bootstrap"
FOUNDATION_DIR="${SCRIPT_DIR}/../../infrastructure/terraform/foundation"
PLAN_FILES=()

cleanup() {
  local plan_file

  for plan_file in "${PLAN_FILES[@]}"; do
    if [[ -f "${plan_file}" ]]; then
      rm -f -- "${plan_file}"
    fi
  done
}

trap cleanup EXIT

for required_command in terraform gcloud; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Missing required command: ${required_command}" >&2
    exit 1
  fi
done

for module_dir in "${BOOTSTRAP_DIR}" "${FOUNDATION_DIR}"; do
  if [[ ! -f "${module_dir}/terraform.tfvars" ]]; then
    echo "Missing ${module_dir}/terraform.tfvars" >&2
    echo "Create it from terraform.tfvars.example before running this script." >&2
    exit 1
  fi
done

gcloud auth application-default print-access-token >/dev/null

cd -- "${BOOTSTRAP_DIR}"
terraform init -input=false
terraform fmt -check
terraform validate

BOOTSTRAP_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-bootstrap-apply.XXXXXX")"
PLAN_FILES+=("${BOOTSTRAP_PLAN}")
terraform plan -input=false -out="${BOOTSTRAP_PLAN}"
terraform apply -input=false "${BOOTSTRAP_PLAN}"

STATE_BUCKET_NAME="$(terraform console -var-file=terraform.tfvars <<<'var.state_bucket_name' | tr -d '\r\"')"

if [[ -z "${STATE_BUCKET_NAME}" ]]; then
  echo "Could not determine state_bucket_name from bootstrap/terraform.tfvars." >&2
  exit 1
fi

cd -- "${FOUNDATION_DIR}"
terraform init -input=false -backend-config="bucket=${STATE_BUCKET_NAME}"
terraform fmt -check -recursive
terraform validate

FOUNDATION_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-foundation-apply.XXXXXX")"
PLAN_FILES+=("${FOUNDATION_PLAN}")
terraform plan -input=false -out="${FOUNDATION_PLAN}"
terraform apply -input=false "${FOUNDATION_PLAN}"

#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -d /snap/bin ]]; then
  export PATH="/snap/bin:$PATH"
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_DIR="${SCRIPT_DIR}/../../infrastructure/terraform/bootstrap"
FOUNDATION_DIR="${SCRIPT_DIR}/../../infrastructure/terraform/foundation"
RUNTIME_DIR="${SCRIPT_DIR}/../../infrastructure/terraform/runtime"

for required_command in terraform awk sort mktemp; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Missing required command: ${required_command}" >&2
    exit 1
  fi
done

if [[ ! -f "${BOOTSTRAP_DIR}/terraform.tfvars" ]]; then
  echo "Missing ${BOOTSTRAP_DIR}/terraform.tfvars" >&2
  exit 1
fi

terraform -chdir="${BOOTSTRAP_DIR}" init -input=false >/dev/null

STATE_BUCKET_NAME="$(terraform -chdir="${BOOTSTRAP_DIR}" console -var-file=terraform.tfvars <<<'var.state_bucket_name' | tr -d '\r"')"

if [[ -z "${STATE_BUCKET_NAME}" ]]; then
  echo "Could not determine state_bucket_name from bootstrap/terraform.tfvars." >&2
  exit 1
fi

print_module_resources() {
  local module_name="$1"
  local module_dir="$2"
  local resources_file total

  if [[ ! -f "${module_dir}/main.tf" ]]; then
    return 0
  fi

  if [[ "${module_name}" != "bootstrap" ]]; then
    terraform -chdir="${module_dir}" init -input=false -backend-config="bucket=${STATE_BUCKET_NAME}" >/dev/null
  fi

  resources_file="$(mktemp "${TMPDIR:-/tmp}/philobiblus-${module_name}-resources.XXXXXX")"
  terraform -chdir="${module_dir}" state list >"${resources_file}"

  total="$(awk 'NF { count++ } END { print count + 0 }' "${resources_file}")"

  printf '\n## %s (%s managed resources)\n' "${module_name}" "${total}"

  if [[ "${total}" == "0" ]]; then
    echo "No resources in Terraform state."
    rm -f -- "${resources_file}"
    return 0
  fi

  sort "${resources_file}" | awk 'NF { print "- " $0 }'
  rm -f -- "${resources_file}"
}

print_module_resources "bootstrap" "${BOOTSTRAP_DIR}"
print_module_resources "foundation" "${FOUNDATION_DIR}"
print_module_resources "runtime" "${RUNTIME_DIR}"

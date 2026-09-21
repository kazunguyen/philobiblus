#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_DIR="${SCRIPT_DIR}/../infrastructure/terraform/bootstrap"
FOUNDATION_DIR="${SCRIPT_DIR}/../infrastructure/terraform/foundation"
RUNTIME_DIR="${SCRIPT_DIR}/../infrastructure/terraform/runtime"
OVERRIDE_FILE="${BOOTSTRAP_DIR}/delete_override.tf"
PLAN_FILES=()
PEERING_DELETE_RETRY_ATTEMPTS="${PEERING_DELETE_RETRY_ATTEMPTS:-30}"
PEERING_DELETE_RETRY_SECONDS="${PEERING_DELETE_RETRY_SECONDS:-120}"
SQL_DELETE_RETRY_ATTEMPTS="${SQL_DELETE_RETRY_ATTEMPTS:-30}"
SQL_DELETE_RETRY_SECONDS="${SQL_DELETE_RETRY_SECONDS:-60}"

cleanup() {
  local plan_file

  rm -f -- "${OVERRIDE_FILE}"

  for plan_file in "${PLAN_FILES[@]}"; do
    if [[ -f "${plan_file}" ]]; then
      rm -f -- "${plan_file}"
    fi
  done
}

trap cleanup EXIT

state_contains() {
  terraform state list | grep -Fxq "$1"
}

wait_for_sql_instance_deletion() {
  local sql_instance_name="$1"
  local attempt

  [[ -z "${sql_instance_name}" ]] && return 0

  echo "Waiting for Cloud SQL instance ${sql_instance_name} to be removed before deleting Private Service Access."

  for ((attempt = 1; attempt <= SQL_DELETE_RETRY_ATTEMPTS; attempt++)); do
    if ! gcloud sql instances describe "${sql_instance_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
      echo "Cloud SQL instance ${sql_instance_name} has been removed."
      return 0
    fi

    if ((attempt == SQL_DELETE_RETRY_ATTEMPTS)); then
      echo "Cloud SQL instance ${sql_instance_name} still exists after ${attempt} checks." >&2
      echo "Wait for its deletion to finish, then run this script again." >&2
      exit 1
    fi

    echo "Cloud SQL instance ${sql_instance_name} is still being deleted; waiting ${SQL_DELETE_RETRY_SECONDS}s (${attempt}/${SQL_DELETE_RETRY_ATTEMPTS})."
    sleep "${SQL_DELETE_RETRY_SECONDS}"
  done
}

assert_no_cloud_sql_private_service_producers() {
  local network_id="$1"
  local sql_instances instance private_network
  local found=false

  if ! sql_instances="$(gcloud sql instances list --project="${PROJECT_ID}" --format='value(name)')"; then
    echo "Could not list Cloud SQL instances to verify Private Service Access consumers." >&2
    exit 1
  fi

  while IFS= read -r instance; do
    [[ -z "${instance}" ]] && continue

    private_network="$(gcloud sql instances describe "${instance}" --project="${PROJECT_ID}" --format='value(settings.ipConfiguration.privateNetwork)' 2>/dev/null || true)"
    if [[ "${private_network}" == "${network_id}" ]]; then
      echo "Cloud SQL instance still uses Private Service Access: ${instance}" >&2
      found=true
    fi
  done <<<"${sql_instances}"

  if [[ "${found}" == true ]]; then
    echo "Delete the listed Cloud SQL instance first. Private Service Access cannot be removed while a producer still uses it." >&2
    return 1
  fi
}

remove_empty_runtime_state() {
  local runtime_state_object="gs://${STATE_BUCKET_NAME}/philobiblus/runtime/default.tfstate"
  local runtime_resources

  if ! gcloud storage ls "${runtime_state_object}" >/dev/null 2>&1; then
    return 0
  fi

  [[ -f "${RUNTIME_DIR}/backend.tf" ]] || {
    echo "Runtime state exists but the runtime Terraform module is unavailable." >&2
    echo "Destroy runtime resources and remove its state before retrying." >&2
    return 1
  }

  terraform -chdir="${RUNTIME_DIR}" init \
    -input=false \
    -backend-config="bucket=${STATE_BUCKET_NAME}" >/dev/null

  if ! runtime_resources="$(terraform -chdir="${RUNTIME_DIR}" state list)"; then
    echo "Could not inspect runtime state before foundation destruction." >&2
    return 1
  fi

  if [[ -n "${runtime_resources}" ]]; then
    echo "Refusing to destroy: runtime state still manages resources:" >&2
    printf '%s\n' "${runtime_resources}" >&2
    return 1
  fi

  echo "Removing the empty runtime state object."
  gcloud storage rm "${runtime_state_object}"
}

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

STATE_BUCKET_NAME="$(terraform console -var-file=terraform.tfvars <<<'var.state_bucket_name' | tr -d '\r\"')"
PROJECT_ID="$(terraform console -var-file=terraform.tfvars <<<'var.project_id' | tr -d '\r\"')"

if [[ -z "${STATE_BUCKET_NAME}" || -z "${PROJECT_ID}" ]]; then
  echo "Could not read project_id or state_bucket_name from bootstrap/terraform.tfvars." >&2
  exit 1
fi

remove_empty_runtime_state

BUCKET_OBJECTS="$(gcloud storage ls --recursive "gs://${STATE_BUCKET_NAME}/**" 2>/dev/null || true)"

if [[ -n "${BUCKET_OBJECTS}" ]]; then
  UNEXPECTED_OBJECTS="$(printf '%s\n' "${BUCKET_OBJECTS}" | grep -v "^gs://${STATE_BUCKET_NAME}/philobiblus/foundation/" || true)"

  if [[ -n "${UNEXPECTED_OBJECTS}" ]]; then
    echo "Refusing to destroy: the state bucket contains data outside the foundation prefix:" >&2
    printf '%s\n' "${UNEXPECTED_OBJECTS}" >&2
    echo "Destroy runtime and migrate any other state before retrying." >&2
    exit 1
  fi
fi

[[ -r /dev/tty ]] || {
  echo "An interactive terminal is required to confirm destruction." >&2
  exit 1
}

printf "Type DESTROY %s to destroy foundation and bootstrap: " "${PROJECT_ID}" >/dev/tty
if ! IFS= read -r confirmation </dev/tty; then
  echo "Could not read destruction confirmation from the terminal." >&2
  exit 1
fi

confirmation="${confirmation%$'\r'}"

if [[ "${confirmation}" != "DESTROY ${PROJECT_ID}" ]]; then
  echo "Deletion cancelled."
  exit 1
fi

cd -- "${FOUNDATION_DIR}"
terraform init -input=false -backend-config="bucket=${STATE_BUCKET_NAME}"
terraform fmt -check -recursive
terraform validate

VPC_NETWORK_ID="$(terraform output -raw network_id 2>/dev/null || true)"
SQL_INSTANCE_NAME="$(terraform output -raw sql_instance_name 2>/dev/null || true)"

if state_contains 'google_sql_database_instance.postgres'; then
  PROTECTION_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-foundation-unprotect.XXXXXX")"
  PLAN_FILES+=("${PROTECTION_PLAN}")

  terraform plan \
    -input=false \
    -target=google_sql_database_instance.postgres \
    -var='protect_data=false' \
    -out="${PROTECTION_PLAN}"
  terraform apply -input=false "${PROTECTION_PLAN}"

  SQL_DESTROY_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-foundation-sql-destroy.XXXXXX")"
  PLAN_FILES+=("${SQL_DESTROY_PLAN}")

  terraform plan -destroy \
    -input=false \
    -target=google_sql_database.app \
    -target=google_sql_database_instance.postgres \
    -var='protect_data=false' \
    -out="${SQL_DESTROY_PLAN}"
  terraform apply -input=false "${SQL_DESTROY_PLAN}"

  wait_for_sql_instance_deletion "${SQL_INSTANCE_NAME}"
fi

if state_contains 'google_service_networking_connection.private_services'; then
  if [[ -z "${VPC_NETWORK_ID}" ]]; then
    echo "Could not determine the VPC ID required to check Private Service Access consumers." >&2
    exit 1
  fi

  if ! assert_no_cloud_sql_private_service_producers "${VPC_NETWORK_ID}"; then
    exit 1
  fi
fi

for ((attempt = 1; attempt <= PEERING_DELETE_RETRY_ATTEMPTS; attempt++)); do
  FOUNDATION_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-foundation-destroy.XXXXXX")"
  PLAN_FILES+=("${FOUNDATION_PLAN}")
  terraform plan -destroy -input=false -var='protect_data=false' -out="${FOUNDATION_PLAN}"

  if terraform apply -input=false "${FOUNDATION_PLAN}"; then
    break
  fi

  if ! state_contains 'google_service_networking_connection.private_services'; then
    echo "Foundation destroy failed for a resource other than Private Service Access." >&2
    exit 1
  fi

  if ! assert_no_cloud_sql_private_service_producers "${VPC_NETWORK_ID}"; then
    exit 1
  fi

  if ((attempt == PEERING_DELETE_RETRY_ATTEMPTS)); then
    echo "Private Service Access is still used by a Google producer after ${attempt} attempts." >&2
    exit 1
  fi

  echo "No Cloud SQL producer remains, but Google Cloud has not released Private Service Access yet; retrying in ${PEERING_DELETE_RETRY_SECONDS}s (attempt ${attempt}/${PEERING_DELETE_RETRY_ATTEMPTS})." >&2
  sleep "${PEERING_DELETE_RETRY_SECONDS}"
done

cd -- "${BOOTSTRAP_DIR}"

cat >"${OVERRIDE_FILE}" <<'EOF'
resource "google_storage_bucket" "terraform_state" {
  force_destroy = true

  lifecycle {
    prevent_destroy = false
  }
}
EOF

terraform fmt -check
terraform validate

BOOTSTRAP_PLAN="$(mktemp "${TMPDIR:-/tmp}/philobiblus-bootstrap-destroy.XXXXXX")"
PLAN_FILES+=("${BOOTSTRAP_PLAN}")
terraform plan -destroy -input=false -out="${BOOTSTRAP_PLAN}"
terraform apply -input=false "${BOOTSTRAP_PLAN}"

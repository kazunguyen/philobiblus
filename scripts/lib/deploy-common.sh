#!/usr/bin/env bash

SCRIPT_LIBRARY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_LIBRARY_DIR}/../.." && pwd)"

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${REGION:-asia-southeast1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"
FRONTEND_REF="${FRONTEND_REF:-main}"

require_commands() {
  local command_name

  for command_name in "$@"; do
    command -v "${command_name}" >/dev/null 2>&1 || {
      echo "Missing required command: ${command_name}" >&2
      exit 1
    }
  done
}

require_variables() {
  local variable_name
  local value

  for variable_name in "$@"; do
    value="${!variable_name:-}"
    [[ -n "${value}" ]] || {
      echo "Set ${variable_name}; see scripts/deploy-gcp.env.example." >&2
      exit 1
    }
  done
}

read_tfvar_string() {
  local file_path="$1"
  local variable_name="$2"
  local value

  value="$(sed -nE "s/^[[:space:]]*${variable_name}[[:space:]]*=[[:space:]]*\"([^\"]+)\".*/\1/p" "${file_path}" | head -n 1)"
  [[ -n "${value}" ]] || {
    echo "Could not read ${variable_name} from ${file_path}" >&2
    exit 1
  }

  printf '%s\n' "${value}"
}

runtime_dir() {
  printf '%s\n' "${PROJECT_ROOT}/infrastructure/terraform/runtime"
}

runtime_state_bucket() {
  read_tfvar_string "$(runtime_dir)/terraform.tfvars" state_bucket_name
}

runtime_init() {
  local directory
  local bucket

  directory="$(runtime_dir)"
  bucket="$(runtime_state_bucket)"

  terraform -chdir="${directory}" init -input=false -backend-config="bucket=${bucket}"
}

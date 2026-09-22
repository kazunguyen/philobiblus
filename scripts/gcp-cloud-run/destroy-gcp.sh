#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/terraform-runtime-delete.sh"
bash "$SCRIPT_DIR/../gcp-shared/terraform-delete.sh"

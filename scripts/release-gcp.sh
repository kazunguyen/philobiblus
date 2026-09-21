#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/dockerhub-build-push.sh"
bash "$SCRIPT_DIR/terraform-runtime-apply.sh"

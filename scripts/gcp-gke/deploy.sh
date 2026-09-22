#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/00-preflight.sh"
"$SCRIPT_DIR/05-install-auth-plugin.sh"
"$SCRIPT_DIR/10-configure.sh"
"$SCRIPT_DIR/20-platform-apply.sh"
"$SCRIPT_DIR/25-kubeconfig.sh"
"$SCRIPT_DIR/27-core-secrets.sh"

if [[ -x "$SCRIPT_DIR/30-app-apply.sh" ]]; then
  "$SCRIPT_DIR/30-app-apply.sh"
fi

"$SCRIPT_DIR/40-verify.sh"
"$SCRIPT_DIR/status.sh"

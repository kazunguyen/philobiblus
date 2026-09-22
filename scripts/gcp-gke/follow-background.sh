#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

RUN_NAME="${1:-20-platform-apply}"
PID_FILE="$LOCAL_DIR/${RUN_NAME}.pid"
LOG_FILE="$LOCAL_DIR/${RUN_NAME}.log"

[[ -f "$LOG_FILE" ]] || die "No background log exists for $RUN_NAME."

if [[ -f "$PID_FILE" ]] && kill -0 "$(<"$PID_FILE")" 2>/dev/null; then
  log "$RUN_NAME is still running as PID $(<"$PID_FILE")."
else
  log "$RUN_NAME is no longer running; showing its final log lines."
fi

tail -n 80 "$LOG_FILE"

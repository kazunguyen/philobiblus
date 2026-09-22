#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

TARGET_SCRIPT="${1:-}"
shift || true

[[ -n "$TARGET_SCRIPT" ]] || die "Usage: bash scripts/k8s-terraform/run-background.sh <script-name> [arguments...]"

case "$TARGET_SCRIPT" in
  20-platform-apply.sh|30-app-apply.sh|deploy.sh) ;;
  *) die "Only 20-platform-apply.sh, 30-app-apply.sh, or deploy.sh may run in the background." ;;
esac

RUN_NAME="${TARGET_SCRIPT%.sh}"
PID_FILE="$LOCAL_DIR/${RUN_NAME}.pid"
LOG_FILE="$LOCAL_DIR/${RUN_NAME}.log"
DEPLOY_LOCK="$LOCAL_DIR/deploy.lock"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(<"$PID_FILE")"
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    die "$TARGET_SCRIPT is already running as PID $EXISTING_PID. Follow: tail -f $LOG_FILE"
  fi
  rm -f -- "$PID_FILE"
fi

touch "$DEPLOY_LOCK"
nohup setsid bash -c 'trap "rm -f -- \"$1\"" EXIT; shift; bash "$@"' \
  bash "$DEPLOY_LOCK" "$SCRIPT_DIR/$TARGET_SCRIPT" "$@" >"$LOG_FILE" 2>&1 < /dev/null &
RUN_PID=$!
printf '%s\n' "$RUN_PID" >"$PID_FILE"

log "Started $TARGET_SCRIPT in the background (PID $RUN_PID)."
log "Follow progress with: tail -f $LOG_FILE"

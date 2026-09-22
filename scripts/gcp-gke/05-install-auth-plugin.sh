#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands curl jq sha256sum tar

TOOLS_DIR="$LOCAL_DIR/tools"
PLUGIN_PATH="$TOOLS_DIR/gke-gcloud-auth-plugin"
MANIFEST_PATH="$LOCAL_DIR/gcloud-components.json"
COMPONENT_ID="gke-gcloud-auth-plugin-linux-x86_64"

if [[ -x "$PLUGIN_PATH" ]]; then
  "$PLUGIN_PATH" --version
  exit 0
fi

mkdir -p "$TOOLS_DIR"
curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/components-2.json \
  -o "$MANIFEST_PATH"

SOURCE_PATH="$(jq -r --arg id "$COMPONENT_ID" '.components[] | select(.id == $id) | .data.source' "$MANIFEST_PATH")"
EXPECTED_SHA256="$(jq -r --arg id "$COMPONENT_ID" '.components[] | select(.id == $id) | .data.checksum' "$MANIFEST_PATH")"

[[ -n "$SOURCE_PATH" && "$SOURCE_PATH" != "null" ]] || die "Could not find $COMPONENT_ID in Google Cloud SDK manifest."
[[ "$EXPECTED_SHA256" =~ ^[0-9a-f]{64}$ ]] || die "Invalid plugin checksum in Google Cloud SDK manifest."

ARCHIVE_PATH="$LOCAL_DIR/gke-gcloud-auth-plugin.tar.gz"
curl -fsSL "https://dl.google.com/dl/cloudsdk/channels/rapid/$SOURCE_PATH" \
  -o "$ARCHIVE_PATH"
printf '%s  %s\n' "$EXPECTED_SHA256" "$ARCHIVE_PATH" | sha256sum --check

tar -xzf "$ARCHIVE_PATH" -C "$TOOLS_DIR"
EXTRACTED_PLUGIN="$(find "$TOOLS_DIR" -type f -name gke-gcloud-auth-plugin -print -quit)"
[[ -n "$EXTRACTED_PLUGIN" ]] || die "Plugin archive did not contain gke-gcloud-auth-plugin."

if [[ "$EXTRACTED_PLUGIN" != "$PLUGIN_PATH" ]]; then
  cp "$EXTRACTED_PLUGIN" "$PLUGIN_PATH"
fi
chmod 700 "$PLUGIN_PATH"

"$PLUGIN_PATH" --version
log "Installed the official GKE auth plugin at ignored path $PLUGIN_PATH"

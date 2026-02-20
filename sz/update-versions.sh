#!/usr/bin/env bash
# update-versions.sh -- Generates Applications/versions.js from git history.
# Run from the sz/ directory (or its parent -- the script auto-detects).
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SZ_DIR="$SCRIPT_DIR"
APPS_DIR="$SZ_DIR/Applications"
CHANGELOG="$SZ_DIR/changelog.txt"
OUTPUT="$APPS_DIR/versions.js"

# ── Git hash ─────────────────────────────────────────────────────
GIT_HASH=$(git -C "$SZ_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_HASH_SHORT="${GIT_HASH:0:8}"

# ── OS version from changelog.txt line 1 ─────────────────────────
OS_VERSION="6.0"
if [[ -f "$CHANGELOG" ]]; then
  FIRST_LINE=$(head -1 "$CHANGELOG")
  # Extract version from "Main: 6.0" format
  VER=$(echo "$FIRST_LINE" | sed -n 's/^Main:[[:space:]]*//p')
  if [[ -n "$VER" ]]; then
    OS_VERSION="$VER"
  fi
fi

# ── Changelog content (JSON-escaped) ─────────────────────────────
if [[ -f "$CHANGELOG" ]]; then
  CHANGELOG_JSON=$(python3 -c "
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    print(json.dumps(f.read()))
" "$CHANGELOG" 2>/dev/null || node -e "
const fs = require('fs');
process.stdout.write(JSON.stringify(fs.readFileSync(process.argv[1], 'utf8')));
" "$CHANGELOG" 2>/dev/null || echo '""')
else
  CHANGELOG_JSON='""'
fi

# ── Per-app version counts ────────────────────────────────────────
APP_ENTRIES=""
for APP_PATH in "$APPS_DIR"/*/; do
  [[ -d "$APP_PATH" ]] || continue
  APP_NAME=$(basename "$APP_PATH")
  # Skip non-app directories
  [[ "$APP_NAME" == "libs" ]] && continue

  # Count commits touching this app's folder
  REL_PATH="sz/Applications/$APP_NAME"
  COUNT=$(git -C "$SZ_DIR/.." log --oneline -- "$REL_PATH" 2>/dev/null | wc -l | tr -d '[:space:]')
  COUNT=${COUNT:-0}

  if [[ -n "$APP_ENTRIES" ]]; then
    APP_ENTRIES="${APP_ENTRIES},"$'\n'
  fi
  APP_ENTRIES="${APP_ENTRIES}    '${APP_NAME}': '1.${COUNT}'"
done

# ── Write output ──────────────────────────────────────────────────
cat > "$OUTPUT" <<JSEOF
;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  SZ.appVersions = {
    gitHash: '${GIT_HASH_SHORT}',
    osVersion: '${OS_VERSION}',
    changelog: ${CHANGELOG_JSON},
    apps: {
${APP_ENTRIES}
    }
  };
})();
JSEOF

echo "[update-versions] Generated $OUTPUT"
echo "  OS version: $OS_VERSION"
echo "  Git hash:   $GIT_HASH_SHORT"
echo "  Apps:       $(echo "$APP_ENTRIES" | wc -l | tr -d '[:space:]') entries"

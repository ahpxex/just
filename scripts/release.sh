#!/usr/bin/env bash
# Build a signed + notarized release bundle.
#
# Set these before running:
#   APPLE_SIGNING_IDENTITY   "Developer ID Application: Name (TEAMID)"
#   APPLE_ID                 your Apple ID email
#   APPLE_PASSWORD           app-specific password from appleid.apple.com
#   APPLE_TEAM_ID            10-char team id
#
# Windows users set TAURI_BUNDLE_WINDOWS_CERTIFICATE_THUMBPRINT instead.
#
# The Tauri CLI reads these from the environment; this wrapper just
# fails early with a clear message if they are missing on macOS.

set -euo pipefail

case "$(uname -s)" in
  Darwin)
    required=(APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID)
    missing=()
    for var in "${required[@]}"; do
      if [ -z "${!var-}" ]; then
        missing+=("$var")
      fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
      echo "release: missing environment variables:" >&2
      printf '  %s\n' "${missing[@]}" >&2
      echo "see README.md → Signing and distribution." >&2
      exit 1
    fi
    ;;
esac

exec bun run tauri build "$@"

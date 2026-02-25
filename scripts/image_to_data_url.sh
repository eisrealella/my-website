#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <image_path>" >&2
  exit 2
fi

img="$1"
if [[ ! -f "$img" ]]; then
  echo "ERR: file not found: $img" >&2
  exit 3
fi

mime="$(file -b --mime-type "$img" 2>/dev/null || true)"
if [[ -z "$mime" || "$mime" != image/* ]]; then
  echo "ERR: not an image mime: ${mime:-unknown}" >&2
  exit 4
fi

# macOS base64 wraps lines by default; strip newlines to build a valid data URL.
b64="$(base64 < "$img" | tr -d '\n')"
printf 'data:%s;base64,%s\n' "$mime" "$b64"

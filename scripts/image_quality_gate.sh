#!/usr/bin/env bash
set -euo pipefail

DEFAULT_MIN_LONG_EDGE=1200
DEFAULT_MIN_BYTES=204800
DEFAULT_CONFIG_FILE="/Users/ella/.openclaw/workspace/scripts/image_quality_gate.conf"
CONFIG_FILE="${IMAGE_QUALITY_GATE_CONFIG:-$DEFAULT_CONFIG_FILE}"

usage() {
  echo "Usage: $0 <absolute_image_path|data:image/...;base64,...>" >&2
}

trim() {
  local s="$1"
  s="${s#${s%%[![:space:]]*}}"
  s="${s%${s##*[![:space:]]}}"
  printf '%s' "$s"
}

read_conf_value() {
  local key="$1"
  local conf="$2"
  if [ ! -f "$conf" ]; then
    return 0
  fi
  local raw=""
  raw="$(awk -F= -v k="$key" '$1 ~ "^[[:space:]]*"k"[[:space:]]*$" {print $2; exit}' "$conf" 2>/dev/null || true)"
  raw="$(trim "$raw")"
  printf '%s' "$raw"
}

resolve_threshold() {
  local env_name="$1"
  local conf_key="$2"
  local fallback="$3"
  local env_val="${!env_name:-}"
  local conf_val=""

  if [[ -n "$env_val" && "$env_val" =~ ^[0-9]+$ ]]; then
    echo "$env_val"
    return
  fi

  conf_val="$(read_conf_value "$conf_key" "$CONFIG_FILE")"
  if [[ -n "$conf_val" && "$conf_val" =~ ^[0-9]+$ ]]; then
    echo "$conf_val"
    return
  fi

  echo "$fallback"
}

MIN_LONG_EDGE="$(resolve_threshold MIN_LONG_EDGE MIN_LONG_EDGE "$DEFAULT_MIN_LONG_EDGE")"
MIN_BYTES="$(resolve_threshold MIN_BYTES MIN_BYTES "$DEFAULT_MIN_BYTES")"

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

input="$1"
source_kind="path"
cleanup_file=""
img_file=""

cleanup() {
  if [ -n "$cleanup_file" ] && [ -f "$cleanup_file" ]; then
    rm -f "$cleanup_file"
  fi
}
trap cleanup EXIT

if [[ "$input" == data:image/* ]]; then
  source_kind="data_url"
  if [[ "$input" != *";base64,"* ]]; then
    echo "RESULT=ERROR"
    echo "REASON=invalid_data_url"
    exit 1
  fi
  b64_payload="${input#*,}"
  cleanup_file="$(mktemp /tmp/openclaw-image-XXXXXX.bin)"
  if ! python3 - "$b64_payload" "$cleanup_file" <<'PY'
import base64
import sys
payload = sys.argv[1]
out = sys.argv[2]
try:
    raw = base64.b64decode(payload, validate=True)
except Exception:
    sys.exit(2)
with open(out, "wb") as f:
    f.write(raw)
PY
  then
    echo "RESULT=ERROR"
    echo "REASON=invalid_base64"
    exit 1
  fi
  img_file="$cleanup_file"
else
  img_file="$input"
  if [ ! -f "$img_file" ]; then
    echo "RESULT=ERROR"
    echo "REASON=file_not_found"
    exit 1
  fi
fi

mime_type="$(file -b --mime-type "$img_file" || true)"
if [[ "$mime_type" != image/* ]]; then
  echo "RESULT=ERROR"
  echo "REASON=not_image_mime"
  echo "MIME=$mime_type"
  exit 1
fi

bytes=""
if bytes="$(stat -f%z "$img_file" 2>/dev/null)"; then
  :
elif bytes="$(stat -c%s "$img_file" 2>/dev/null)"; then
  :
else
  echo "RESULT=ERROR"
  echo "REASON=stat_failed"
  exit 1
fi

sips_out="$(sips -g pixelWidth -g pixelHeight "$img_file" 2>/dev/null || true)"
width="$(printf '%s\n' "$sips_out" | awk '/pixelWidth:/ {print $2; exit}')"
height="$(printf '%s\n' "$sips_out" | awk '/pixelHeight:/ {print $2; exit}')"

if [ -z "$width" ] || [ -z "$height" ]; then
  echo "RESULT=ERROR"
  echo "REASON=dimension_probe_failed"
  exit 1
fi

long_edge="$width"
if [ "$height" -gt "$long_edge" ]; then
  long_edge="$height"
fi

reasons=()
if [ "$bytes" -lt "$MIN_BYTES" ]; then
  reasons+=("too_small_bytes")
fi
if [ "$long_edge" -lt "$MIN_LONG_EDGE" ]; then
  reasons+=("too_small_edge")
fi

if [ "${#reasons[@]}" -eq 0 ]; then
  result="PASS"
  reason="ok"
  exit_code=0
else
  result="FAIL"
  reason="$(IFS=,; echo "${reasons[*]}")"
  exit_code=2
fi

echo "RESULT=$result"
echo "REASON=$reason"
echo "SOURCE_KIND=$source_kind"
echo "MIME=$mime_type"
echo "WIDTH=$width"
echo "HEIGHT=$height"
echo "LONG_EDGE=$long_edge"
echo "BYTES=$bytes"
echo "MIN_LONG_EDGE=$MIN_LONG_EDGE"
echo "MIN_BYTES=$MIN_BYTES"
echo "CONFIG_FILE=$CONFIG_FILE"

exit "$exit_code"

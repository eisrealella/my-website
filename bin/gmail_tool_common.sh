#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${GMAIL_SKILL_SCRIPT:-$HOME/.openclaw/workspace-coder/skills/gmail-oauth-mail/scripts/gmail_skill.py}"
TOKEN_PATH="${GMAIL_TOKEN_PATH:-$HOME/.openclaw/gmail-token.json}"
ENV_FILE="${GMAIL_ENV_FILE:-$HOME/.openclaw/gmail-oauth.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "ERROR: gmail skill script not found: $SCRIPT" >&2
  exit 1
fi

run_gmail_skill() {
  python3 "$SCRIPT" --token-path "$TOKEN_PATH" "$@"
}

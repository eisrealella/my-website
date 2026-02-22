#!/bin/bash
# 兼容入口：优先使用 Peekaboo bridge 下载流程

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PEEKABOO_SCRIPT="$SCRIPT_DIR/thunder-download-peekaboo.sh"
MAGNET_LINK="${1:-}"

if [ -z "$MAGNET_LINK" ]; then
  echo "❌ 用法: $0 \"magnet链接\""
  exit 2
fi

if [ -x "$PEEKABOO_SCRIPT" ]; then
  bash "$PEEKABOO_SCRIPT" "$MAGNET_LINK"
  exit $?
fi

echo "⚠️ 未找到 Peekaboo 脚本，回退 AppleScript 方案"
open "$MAGNET_LINK"
sleep 5
osascript << APPLESCRIPT
tell application "Thunder"
    activate
    delay 1
end tell
tell application "System Events"
    tell process "Thunder"
        try
            click button "开始下载" of window 1
        on error
            try
                click button "Start" of window 1
            on error
                try
                    key code 36
                end try
            end try
        end try
    end tell
end tell
APPLESCRIPT

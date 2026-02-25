#!/bin/bash
# 用 Peekaboo 自动点击 Thunder 下载按钮（优先 bridge，必要时回退 local）
# 用法: ./thunder-download-peekaboo.sh "magnet链接"

set -u

MAGNET_LINK="${1:-}"
if [ -z "$MAGNET_LINK" ]; then
  echo "❌ 用法: $0 \"magnet链接\""
  exit 2
fi

if ! command -v peekaboo >/dev/null 2>&1; then
  echo "❌ 未找到 peekaboo，请先安装：brew install steipete/tap/peekaboo"
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ 未找到 jq，请先安装：brew install jq"
  exit 2
fi

OPENCLAW_SOCKET="$HOME/Library/Application Support/OpenClaw/bridge.sock"
CLAWDIS_DIR="$HOME/Library/Application Support/clawdis"
CLAWDIS_SOCKET="$CLAWDIS_DIR/bridge.sock"

if [ -S "$OPENCLAW_SOCKET" ] && [ ! -e "$CLAWDIS_SOCKET" ]; then
  mkdir -p "$CLAWDIS_DIR"
  ln -s "$OPENCLAW_SOCKET" "$CLAWDIS_SOCKET"
fi

echo "🔎 检查 Peekaboo Bridge..."
BRIDGE_JSON="$(peekaboo bridge status --json 2>/dev/null || true)"
BRIDGE_SOURCE="$(printf '%s' "$BRIDGE_JSON" | jq -r '.data.selected.source // "unknown"' 2>/dev/null || echo "unknown")"
BRIDGE_PERM_SR="$(printf '%s' "$BRIDGE_JSON" | jq -r '.data.selected.handshake.permissions.screenRecording // false' 2>/dev/null || echo "false")"
BRIDGE_PERM_AX="$(printf '%s' "$BRIDGE_JSON" | jq -r '.data.selected.handshake.permissions.accessibility // false' 2>/dev/null || echo "false")"
BRIDGE_PERM_AS="$(printf '%s' "$BRIDGE_JSON" | jq -r '.data.selected.handshake.permissions.appleScript // false' 2>/dev/null || echo "false")"
echo "   source=${BRIDGE_SOURCE} SR=${BRIDGE_PERM_SR} AX=${BRIDGE_PERM_AX} AS=${BRIDGE_PERM_AS}"

echo "👀 检查运行权限..."
PERM_JSON="$(peekaboo permissions status --json 2>/dev/null || true)"
REMOTE_PERM_OK="$(printf '%s' "$PERM_JSON" | jq -r '[.data.permissions[]? | select(.isRequired == true) | .isGranted] | all' 2>/dev/null || echo "false")"
LOCAL_PERM_JSON="$(peekaboo permissions status --json --no-remote 2>/dev/null || true)"
LOCAL_PERM_OK="$(printf '%s' "$LOCAL_PERM_JSON" | jq -r '[.data.permissions[]? | select(.isRequired == true) | .isGranted] | all' 2>/dev/null || echo "false")"
if [ "$REMOTE_PERM_OK" != "true" ] && [ "$LOCAL_PERM_OK" != "true" ]; then
  echo "❌ 当前可用权限不足（至少需要屏幕录制 + 辅助功能）"
  echo "   请在系统设置 > 隐私与安全性中给 OpenClaw 或 Peekaboo 开启权限后重试"
  exit 1
fi

echo "🚀 启动 Thunder..."
open "$MAGNET_LINK"
echo "⏳ 等待 Thunder 弹窗..."
sleep 5

echo "📸 采集当前屏幕快照..."
peekaboo image --mode screen --path /tmp/thunder-popup.png --retina >/dev/null 2>&1 || true

CLICK_OK=0
CLICK_LABEL=""
CLICK_APP="迅雷"
if peekaboo window list --app "迅雷" --json >/dev/null 2>&1; then
  CLICK_APP="迅雷"
elif peekaboo window list --app "Thunder" --json >/dev/null 2>&1; then
  CLICK_APP="Thunder"
fi

WINDOWS_JSON="$(peekaboo window list --app "$CLICK_APP" --json 2>/dev/null || true)"
SMALL_WIN_CANDIDATES="$(printf '%s' "$WINDOWS_JSON" | jq -r '
  [.data.windows[]? 
   | select(.bounds.width >= 240 and .bounds.height >= 220 and .bounds.width <= 620 and .bounds.height <= 520)
   | {
       x1: (.bounds.x + (.bounds.width * 0.78) | floor),
       y1: (.bounds.y + (.bounds.height * 0.88) | floor),
       x2: (.bounds.x + (.bounds.width * 0.62) | floor),
       y2: (.bounds.y + (.bounds.height * 0.88) | floor),
       x3: (.bounds.x + (.bounds.width * 0.50) | floor),
       y3: (.bounds.y + (.bounds.height * 0.88) | floor)
     }]
  | .[]
  | "\(.x1),\(.y1)\n\(.x2),\(.y2)\n\(.x3),\(.y3)"
' 2>/dev/null || true)"

MAIN_WIN_CANDIDATES="$(printf '%s' "$WINDOWS_JSON" | jq -r '
  [.data.windows[]?
   | select(.bounds.width >= 700 and .bounds.height >= 420)
   | {
       x1: (.bounds.x + (.bounds.width * 0.86) | floor),
       y1: (.bounds.y + (.bounds.height * 0.90) | floor),
       x2: (.bounds.x + (.bounds.width * 0.72) | floor),
       y2: (.bounds.y + (.bounds.height * 0.90) | floor),
       x3: (.bounds.x + (.bounds.width * 0.60) | floor),
       y3: (.bounds.y + (.bounds.height * 0.90) | floor)
     }]
  | .[]
  | "\(.x1),\(.y1)\n\(.x2),\(.y2)\n\(.x3),\(.y3)"
' 2>/dev/null || true)"

COORD_CANDIDATES="$(printf '%s\n%s\n%s\n%s\n' \
  "$SMALL_WIN_CANDIDATES" \
  "$MAIN_WIN_CANDIDATES" \
  "600,450" \
  "820,620" | awk 'NF' | awk '!seen[$0]++')"

# 优先精确点击关键按钮，避免误点“下载”而非“立即下载”
BUTTON_SNAPSHOT=""
BUTTON_IMMEDIATE_ID=""
BUTTON_START_ID=""
BUTTON_DOWNLOAD_ID=""
DIALOG_IS_CLOUD=0
BUTTON_PICK_DIR_ID=""
BUTTON_GAME_ID=""
BUTTON_JSON="/tmp/thunder-button-scan.json"
peekaboo see --app "$CLICK_APP" --mode frontmost --json --path /tmp/thunder-button-scan.png > "$BUTTON_JSON" 2>/dev/null || true
BUTTON_SNAPSHOT="$(jq -r '.data.snapshot_id // ""' "$BUTTON_JSON" 2>/dev/null || echo "")"
BUTTON_IMMEDIATE_ID="$(jq -r '.data.ui_elements[]? | select((.label=="立即下载") or (.title=="立即下载")) | .id' "$BUTTON_JSON" 2>/dev/null | head -n1)"
BUTTON_START_ID="$(jq -r '.data.ui_elements[]? | select((.label=="开始下载") or (.title=="开始下载")) | .id' "$BUTTON_JSON" 2>/dev/null | head -n1)"
BUTTON_DOWNLOAD_ID="$(jq -r '.data.ui_elements[]? | select((.label=="下载") or (.title=="下载")) | .id' "$BUTTON_JSON" 2>/dev/null | head -n1)"
BUTTON_PICK_DIR_ID="$(jq -r '.data.ui_elements[]? | select((.label=="选择目录") or (.title=="选择目录") or (.label=="选择云盘目录") or (.title=="选择云盘目录")) | .id' "$BUTTON_JSON" 2>/dev/null | head -n1)"
BUTTON_GAME_ID="$(jq -r '.data.ui_elements[]? | select((.label=="Game") or (.title=="Game")) | .id' "$BUTTON_JSON" 2>/dev/null | head -n1)"
if jq -e '.data.ui_elements[]? | ((.label // "") + " " + (.title // "")) | test("添加到云盘|下载到云盘|云添加剩余次数|云盘文件")' "$BUTTON_JSON" >/dev/null 2>&1; then
  DIALOG_IS_CLOUD=1
fi

click_with_runtime() {
  local coords="$1"
  if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" = "true" ] && [ "$REMOTE_PERM_OK" = "true" ]; then
    peekaboo click --app "$CLICK_APP" --coords "$coords" >/dev/null 2>&1
  else
    peekaboo click --app "$CLICK_APP" --coords "$coords" --no-remote >/dev/null 2>&1
  fi
}

click_id_with_runtime() {
  local snap="$1"
  local on_id="$2"
  if [ -z "$snap" ] || [ -z "$on_id" ] || [ "$on_id" = "null" ]; then
    return 1
  fi
  if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" = "true" ] && [ "$REMOTE_PERM_OK" = "true" ]; then
    peekaboo click --app "$CLICK_APP" --snapshot "$snap" --on "$on_id" >/dev/null 2>&1
  else
    peekaboo click --app "$CLICK_APP" --snapshot "$snap" --on "$on_id" --no-remote >/dev/null 2>&1
  fi
}

if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" = "true" ] && [ "$REMOTE_PERM_OK" = "true" ]; then
  echo "🖱️ 使用 bridge 点击下载按钮（动态坐标）..."
else
  echo "⚠️ bridge 未开启 Accessibility，回退到 local 点击（动态坐标）..."
fi

# 如果当前在“存储到云盘”目录选择层，先完成目录确认，再回到新建BT任务点“立即下载”
if [ "$DIALOG_IS_CLOUD" -eq 1 ] && [ -n "$BUTTON_PICK_DIR_ID" ] && [ "$BUTTON_PICK_DIR_ID" != "null" ]; then
  echo "📁 检测到云盘目录选择层，先确认目录..."
  click_id_with_runtime "$BUTTON_SNAPSHOT" "$BUTTON_GAME_ID" || true
  sleep 0.3
  click_id_with_runtime "$BUTTON_SNAPSHOT" "$BUTTON_PICK_DIR_ID" || true
  sleep 0.8

  BUTTON_JSON2="/tmp/thunder-button-scan-after-dir.json"
  peekaboo see --app "$CLICK_APP" --mode window --window-title "新建下载任务" --json --path /tmp/thunder-button-scan-after-dir.png > "$BUTTON_JSON2" 2>/dev/null || true
  BUTTON_SNAPSHOT="$(jq -r '.data.snapshot_id // ""' "$BUTTON_JSON2" 2>/dev/null || echo "$BUTTON_SNAPSHOT")"
  BUTTON_IMMEDIATE_ID="$(jq -r '.data.ui_elements[]? | select((.label=="立即下载") or (.title=="立即下载")) | .id' "$BUTTON_JSON2" 2>/dev/null | head -n1)"
  BUTTON_START_ID="$(jq -r '.data.ui_elements[]? | select((.label=="开始下载") or (.title=="开始下载")) | .id' "$BUTTON_JSON2" 2>/dev/null | head -n1)"
  BUTTON_DOWNLOAD_ID="$(jq -r '.data.ui_elements[]? | select((.label=="下载") or (.title=="下载")) | .id' "$BUTTON_JSON2" 2>/dev/null | head -n1)"
fi

# 强优先：立即下载 -> 开始下载（不再把“下载”当作成功，避免误点目录/标签）
if click_id_with_runtime "$BUTTON_SNAPSHOT" "$BUTTON_IMMEDIATE_ID"; then
  CLICK_OK=1
  CLICK_LABEL="立即下载"
elif click_id_with_runtime "$BUTTON_SNAPSHOT" "$BUTTON_START_ID"; then
  CLICK_OK=1
  CLICK_LABEL="开始下载"
fi

# 不做坐标盲点，避免误点到目录/标签；仅允许按钮文本/ID命中

if [ "$CLICK_OK" -ne 1 ]; then
  if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" = "true" ] && [ "$REMOTE_PERM_OK" = "true" ]; then
    if peekaboo click "立即下载" --app "$CLICK_APP" --wait-for 2000 >/dev/null 2>&1; then
      CLICK_OK=1
      CLICK_LABEL="立即下载(文本匹配)"
    elif peekaboo click "开始下载" --app "$CLICK_APP" --wait-for 2000 >/dev/null 2>&1; then
      CLICK_OK=1
      CLICK_LABEL="开始下载(文本匹配)"
    fi
  else
    if peekaboo click "立即下载" --app "$CLICK_APP" --wait-for 2000 --no-remote >/dev/null 2>&1; then
      CLICK_OK=1
      CLICK_LABEL="立即下载(文本匹配)"
    elif peekaboo click "开始下载" --app "$CLICK_APP" --wait-for 2000 --no-remote >/dev/null 2>&1; then
      CLICK_OK=1
      CLICK_LABEL="开始下载(文本匹配)"
    fi
  fi
fi

if [ "$CLICK_OK" -ne 1 ]; then
  echo "⌨️ 点击失败，尝试回车确认..."
  if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" = "true" ]; then
    peekaboo press return --app "Thunder" >/dev/null 2>&1 || true
    peekaboo press space --app "Thunder" >/dev/null 2>&1 || true
    peekaboo press return --app "迅雷" >/dev/null 2>&1 || true
    peekaboo press space --app "迅雷" >/dev/null 2>&1 || true
  else
    peekaboo --no-remote press return --app "Thunder" >/dev/null 2>&1 || true
    peekaboo --no-remote press space --app "Thunder" >/dev/null 2>&1 || true
    peekaboo --no-remote press return --app "迅雷" >/dev/null 2>&1 || true
    peekaboo --no-remote press space --app "迅雷" >/dev/null 2>&1 || true
  fi
fi

if [ "$CLICK_OK" -eq 1 ]; then
  echo "✅ 已自动点击下载按钮: ${CLICK_LABEL:-<unknown>}"
else
  echo "⚠️ 未能稳定定位按钮，请手动点击“立即下载/开始下载”"
fi

# 云端保存成功判定：前台弹窗出现“已保存到云端”等提示
CLOUD_OK=0
for i in 1 2 3 4 5 6 7 8; do
  STATE_JSON="/tmp/thunder-cloud-status-${i}.json"
  peekaboo see --app "迅雷" --mode frontmost --json --path "/tmp/thunder-cloud-status-${i}.png" > "$STATE_JSON" 2>/dev/null || true
  if jq -e '.data.ui_elements[]? | ((.label // "") + " " + (.title // "")) | test("已保存到云端|保存到云端|已添加到云盘|已保存到云盘")' "$STATE_JSON" >/dev/null 2>&1; then
    CLOUD_OK=1
    break
  fi
  sleep 1
done

if [ "$CLOUD_OK" -eq 1 ]; then
  echo "✅ 检测到“已保存到云端”提示，下载流程成功"
else
  echo "ℹ️ 未检测到“已保存到云端”提示（可能提示已消失过快）"
fi

if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AX" != "true" ]; then
  echo "ℹ️ 建议补齐 OpenClaw 权限：Accessibility=ON（当前为 OFF）"
fi
if [ "$BRIDGE_SOURCE" = "remote" ] && [ "$BRIDGE_PERM_AS" != "true" ]; then
  echo "ℹ️ 建议补齐 OpenClaw 权限：Apple Events=ON（当前为 OFF）"
fi

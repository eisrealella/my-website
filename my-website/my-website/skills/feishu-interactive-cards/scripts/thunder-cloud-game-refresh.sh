#!/bin/bash
# 验证迅雷云盘 Game 文件夹是否出现目标游戏
# 用法: ./thunder-cloud-game-refresh.sh "Disco Elysium"

set -u

TARGET_GAME="${1:-}"
APP_CN="迅雷"
APP_EN="Thunder"
APP="$APP_CN"

if ! command -v peekaboo >/dev/null 2>&1; then
  echo "❌ 未找到 peekaboo"
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ 未找到 jq"
  exit 2
fi

pick_app() {
  if peekaboo window list --app "$APP_CN" --json >/dev/null 2>&1; then
    APP="$APP_CN"
  elif peekaboo window list --app "$APP_EN" --json >/dev/null 2>&1; then
    APP="$APP_EN"
  else
    APP="$APP_CN"
  fi
}

see_json() {
  local tag="$1"
  local out="/tmp/thunder-cloud-${tag}.json"
  local img="/tmp/thunder-cloud-${tag}.png"
  peekaboo see --app "$APP" --mode window --json --path "$img" > "$out" 2>/dev/null || true
  echo "$out"
}

find_id() {
  local json="$1"
  local re="$2"
  jq -r --arg re "$re" '
    .data.ui_elements[]?
    | select((((.label // "") + " " + (.title // "")) | test($re)))
    | .id
  ' "$json" | head -n1
}

click_id() {
  local json="$1"
  local on_id="$2"
  local snap
  snap="$(jq -r '.data.snapshot_id // ""' "$json")"
  [ -z "$snap" ] && return 1
  [ -z "$on_id" ] && return 1
  [ "$on_id" = "null" ] && return 1
  peekaboo click --app "$APP" --snapshot "$snap" --on "$on_id" >/dev/null 2>&1
}

contains_text() {
  local json="$1"
  local re="$2"
  jq -e --arg re "$re" '
    [.data.ui_elements[]? | ((.label // "") + " " + (.title // "")) | test($re)]
    | any
  ' "$json" >/dev/null 2>&1
}

echo "🚀 激活迅雷窗口..."
open -a "$APP_EN" >/dev/null 2>&1 || true
sleep 1
pick_app
echo "   app=$APP"

echo "1) see 当前页面"
JSON1="$(see_json "step1-before-cloud")"

echo "2) 点击左侧云盘（如果当前不在云盘）"
if contains_text "$JSON1" "全部文件|云盘文件"; then
  echo "   ℹ️ 当前已在云盘页面"
else
  CLOUD_ID="$(find_id "$JSON1" "^云盘$| 云盘$|^云盘 ")"
  if [ -n "${CLOUD_ID:-}" ] && [ "$CLOUD_ID" != "null" ]; then
    click_id "$JSON1" "$CLOUD_ID" || true
    sleep 1
  else
    peekaboo click "云盘" --app "$APP" --wait-for 2000 >/dev/null 2>&1 || true
    sleep 1
  fi
fi

echo "3) see 云盘页面"
JSON2="$(see_json "step2-after-cloud")"
if ! contains_text "$JSON2" "全部文件|云盘文件"; then
  echo "❌ 未确认进入云盘页面"
  exit 1
fi

echo "4) 双击 Game 文件夹"
GAME_ID="$(find_id "$JSON2" "^Game$| Game$|^Game ")"
if [ -z "${GAME_ID:-}" ] || [ "$GAME_ID" = "null" ]; then
  JSON2B="$(see_json "step2b-game-search")"
  GAME_ID="$(find_id "$JSON2B" "^Game$| Game$|^Game ")"
  JSON2="$JSON2B"
fi
if [ -n "${GAME_ID:-}" ] && [ "$GAME_ID" != "null" ]; then
  click_id "$JSON2" "$GAME_ID" || true
  sleep 0.25
  click_id "$JSON2" "$GAME_ID" || true
  sleep 1
else
  peekaboo click "Game" --app "$APP" --wait-for 2000 >/dev/null 2>&1 || true
  sleep 0.25
  peekaboo click "Game" --app "$APP" --wait-for 2000 >/dev/null 2>&1 || true
  sleep 1
fi

echo "5) see Game 页面"
JSON3="$(see_json "step3-in-game")"
if ! contains_text "$JSON3" "Game"; then
  echo "❌ 未确认进入 Game 文件夹"
  exit 1
fi

echo "6) 点击右上角刷新图标"
REFRESH_CLICKED=0
# 已验证：迅雷云盘右上圆形按钮中，第2个（常见 id=elem_59）是刷新
if click_id "$JSON3" "elem_59"; then
  REFRESH_CLICKED=1
  echo "   ✅ 已点击刷新按钮（elem_59）"
else
  REFRESH_ID="$(find_id "$JSON3" "刷新|重新加载|reload|refresh")"
  if [ -n "${REFRESH_ID:-}" ] && [ "$REFRESH_ID" != "null" ] && click_id "$JSON3" "$REFRESH_ID"; then
    REFRESH_CLICKED=1
    echo "   ✅ 已点击刷新按钮（文本匹配）"
  else
    if peekaboo click "刷新" --app "$APP" --wait-for 2000 >/dev/null 2>&1; then
      REFRESH_CLICKED=1
      echo "   ✅ 已点击刷新按钮（字符串回退）"
    fi
  fi
fi
if [ "$REFRESH_CLICKED" -ne 1 ]; then
  echo "⚠️ 刷新按钮点击未确认成功"
fi
sleep 2

echo "7) see 刷新后页面"
JSON4="$(see_json "step4-after-refresh")"

if [ -n "$TARGET_GAME" ]; then
  if contains_text "$JSON4" "$TARGET_GAME"; then
    echo "✅ 已在云盘 Game 文件夹检测到目标游戏: $TARGET_GAME"
    exit 0
  else
    echo "⚠️ 刷新后未检测到目标游戏: $TARGET_GAME"
    echo "   可检查 /tmp/thunder-cloud-step4-after-refresh.png"
    exit 3
  fi
fi

echo "✅ 已完成云盘-Game-刷新流程（未指定目标游戏名，仅执行流程）"

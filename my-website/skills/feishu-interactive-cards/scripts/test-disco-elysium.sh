#!/bin/bash
# 完整测试：下载极乐disco
# 用法: ./test-disco-elysium.sh

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  极乐disco (Disco Elysium) 下载测试"
echo "========================================="
echo ""

# Magnet 链接
MAGNET="magnet:?xt=urn:btih:9D2EE7382CD647ABB876AD401F4E6BD075654F10&dn=Disco+Elysium%3A+The+Final+Cut+Bundle+%28GOG+Build+a0a063ab+%2B+Bonus+Content%2C+MULTi13%29+%5BFitGirl+Repack%2C+Selective+Download%29"

echo "1️⃣ 检查 Peekaboo 权限..."
echo "   运行: peekaboo bridge status --verbose"
peekaboo bridge status --verbose
echo ""

echo "2️⃣ 触发下载流程（仅一次 magnet，避免双弹窗）..."
echo "   由 thunder-download-peekaboo.sh 内部统一 open magnet"
echo "   ⏳ 直接进入自动化步骤..."
echo ""

echo "3️⃣ 截图查看当前屏幕..."
echo "   运行: peekaboo image --mode screen --path /tmp/thunder-disco.png --retina"
if peekaboo image --mode screen --path /tmp/thunder-disco.png --retina 2>/dev/null; then
    echo "   ✅ 截图成功: /tmp/thunder-disco.png"
else
    echo "   ❌ 截图失败"
fi
echo ""

echo "4️⃣ 尝试自动点击下载按钮..."
echo "   运行: ${SCRIPT_DIR}/thunder-download-peekaboo.sh（内置 bridge + fallback）"
if bash "${SCRIPT_DIR}/thunder-download-peekaboo.sh" "$MAGNET"; then
    echo "   ✅ 自动流程执行完成"
else
    echo "   ❌ 自动流程执行失败"
fi
echo ""

echo "5️⃣ 完成！"
echo "========================================="

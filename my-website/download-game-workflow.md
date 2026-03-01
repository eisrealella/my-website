# 下载游戏工作流进度

## 目标
自动从 FitGirl 下载游戏到 Thunder（macOS 下载工具）

## 当前状态
**进行中** - 权限配置阶段

---

## 已完成 ✅

1. **找到 magnet 链接**
   - 游戏：Disco Elysium: The Final Cut Bundle
   - 链接：`magnet:?xt=urn:btih:9D2EE7382CD647ABB876AD401F4E6BD075654F10...`

2. **运行下载脚本**
   ```bash
   bash ~/.openclaw/workspace/skills/feishu-interactive-cards/scripts/thunder-download.sh "<magnet链接>"
   ```
   - ✅ Thunder 已打开
   - ✅ magnet 链接已传入
   - ❌ 未成功点击"立即下载"按钮

3. **Peekaboo 已安装**
   - 路径：`/opt/homebrew/bin/peekaboo`
   - 功能：macOS 原生应用控制（截屏、点击、输入等）
   - 权限：已在系统设置中添加

---

## 待解决 ⚠️

### 权限问题
- **Peekaboo**：屏幕录制 + 辅助功能（已添加到系统设置，但需要重启生效）
- **终端 (osascript)**：辅助功能（可选，作为备用方案）

### 重启后需要验证
```bash
# 1. 验证 Peekaboo 权限
peekaboo permissions status

# 2. 验证 Peekaboo 能正常工作
peekaboo image --app Thunder --mode window --path /tmp/thunder.png --retina

# 3. 查看 Thunder 窗口按钮
peekaboo see --app Thunder --annotate
```

---

## 下一步操作（重启后）

### 方案1：使用 Peekaboo 点击
```bash
# 截屏 Thunder 窗口
peekaboo image --app Thunder --mode window --path /tmp/thunder.png --retina

# 查看并点击按钮
peekaboo click --on "立即下载" --app Thunder
```

### 方案2：更新 thunder-download.sh 脚本
如果 Peekaboo 可用，更新脚本使用 Peekaboo 点击：
```bash
# 更新后
bash thunder-download.sh "<magnet>"
```

---

## 相关文件
- 脚本：`~/.openclaw/workspace/skills/feishu-interactive-cards/scripts/thunder-download.sh`
- MEMORY：~/workspace/MEMORY.md

---

## 参考资料
- Peekaboo GitHub: https://github.com/steipete/Peekaboo
- 功能：截屏、点击、输入、窗口管理等 macOS 原生自动化

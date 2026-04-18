---
name: feishu-interactive-cards
version: 1.0.2
description: Create and send interactive cards to Feishu (Lark) with buttons, forms, polls, and rich UI elements. Use when replying to Feishu messages and there is ANY uncertainty - send an interactive card instead of plain text to let users choose via buttons. Automatically handles callbacks via long-polling connection. Use for confirmations, choices, forms, todos, polls, or any scenario requiring user interaction in Feishu.
---

# Feishu Interactive Cards

## Core Principle

**When replying to Feishu and there is ANY uncertainty: send an interactive card instead of plain text.**

Interactive cards let users respond via buttons rather than typing, making interactions faster and clearer.

## When to Use

**Must use interactive cards:**
- User needs to make a choice (yes/no, multiple options)
- Confirmation required before action
- Displaying todos or task lists
- Creating polls or surveys
- Collecting form input
- Any uncertain situation

**Plain text is OK:**
- Simple notifications (no response needed)
- Pure data display (no interaction)
- Confirmed command results

**Example:**
- Wrong: "I deleted the file for you" (direct execution)
- Right: Send card "Confirm delete file?" [Confirm] [Cancel]

## Quick Start

### 1. Start Callback Server (Long-Polling Mode)

```bash
cd E:\openclaw\workspace\skills\feishu-interactive-cards\scripts
node card-callback-server.js
```

**Features:**
- Uses Feishu long-polling (no public IP needed)
- Auto-reconnects
- Sends callbacks to OpenClaw Gateway automatically

### 2. Send Interactive Card

```bash
# Confirmation card
node scripts/send-card.js confirmation "Confirm delete file?" --chat-id oc_xxx

# Todo list
node scripts/send-card.js todo --chat-id oc_xxx

# Poll
node scripts/send-card.js poll "Team activity" --options "Bowling,Movie,Dinner" --chat-id oc_xxx

# Custom card
node scripts/send-card.js custom --template examples/custom-card.json --chat-id oc_xxx
```

### 3. Use in Agent

When Agent needs to send Feishu messages:

```javascript
// Wrong: Send plain text
await message({ 
  action: "send", 
  channel: "feishu", 
  message: "Confirm delete?" 
});

// Right: Send interactive card
await exec({
  command: `node E:\\openclaw\\workspace\\skills\\feishu-interactive-cards\\scripts\\send-card.js confirmation "Confirm delete file test.txt?" --chat-id ${chatId}`
});
```

## Card Templates

See `examples/` directory for complete card templates:
- `confirmation-card.json` - Confirmation dialogs
- `todo-card.json` - Task lists with checkboxes
- `poll-card.json` - Polls and surveys
- `form-card.json` - Forms with input fields

For detailed card design patterns and best practices, see [references/card-design-guide.md](references/card-design-guide.md).

## Callback Handling

Callback server automatically sends all card interactions to OpenClaw Gateway. For detailed integration guide, see [references/gateway-integration.md](references/gateway-integration.md).

**Quick example:**

```javascript
// Handle confirmation
if (callback.data.action.value.action === "confirm") {
  const file = callback.data.action.value.file;
  
  // ⚠️ SECURITY: Validate and sanitize file path before use
  // Use OpenClaw's built-in file operations instead of shell commands
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Validate file path (prevent directory traversal)
    const safePath = path.resolve(file);
    if (!safePath.startsWith(process.cwd())) {
      throw new Error('Invalid file path');
    }
    
    // Use fs API instead of shell command
    await fs.unlink(safePath);
    
    // Update card
    await updateCard(callback.context.open_message_id, {
      header: { title: "Done", template: "green" },
      elements: [
        { tag: "div", text: { content: `File ${path.basename(safePath)} deleted`, tag: "lark_md" } }
      ]
    });
  } catch (error) {
    // Handle error
    await updateCard(callback.context.open_message_id, {
      header: { title: "Error", template: "red" },
      elements: [
        { tag: "div", text: { content: `Failed to delete file: ${error.message}`, tag: "lark_md" } }
      ]
    });
  }
}
```

## Best Practices

### Card Design
- Clear titles and content
- Obvious button actions
- Use `danger` type for destructive operations
- Carry complete state in button `value` to avoid extra queries

### Interaction Flow
```
User request -> Agent decides -> Send card -> User clicks button 
-> Callback server -> Gateway -> Agent handles -> Update card/execute
```

### Error Handling
- Timeout: Send reminder if user doesn't respond
- Duplicate clicks: Built-in deduplication (3s window)
- Failures: Update card to show error message

### Performance
- Async processing: Quick response, long tasks in background
- Batch operations: Combine related actions in one card

## Configuration

Configure in `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "feishu": {
      "accounts": {
        "main": {
          "appId": "YOUR_APP_ID",
          "appSecret": "YOUR_APP_SECRET"
        }
      }
    }
  },
  "gateway": {
    "enabled": true,
    "port": 18789,
    "token": "YOUR_GATEWAY_TOKEN"
  }
}
```

Callback server reads config automatically.

## Troubleshooting

**Button clicks not working:**
- Check callback server is running
- Verify Feishu backend uses "long-polling" mode
- Ensure `card.action.trigger` event is subscribed

**Gateway not receiving callbacks:**
- Start Gateway: `E:\openclaw\workspace\scripts\gateway.cmd`
- Check token in `~/.openclaw\openclaw.json`

**Card display issues:**
- Use provided templates as base
- Validate JSON format
- Check required fields

## Security

**⚠️ CRITICAL: Never pass user input directly to shell commands!**

This skill includes comprehensive security guidelines. Please read [references/security-best-practices.md](references/security-best-practices.md) before implementing callback handlers.

Key security principles:
- Always validate and sanitize user input
- Use Node.js built-in APIs instead of shell commands
- Implement proper permission checks
- Prevent command injection vulnerabilities
- Use event_id for deduplication

## References

- [Security Best Practices](references/security-best-practices.md) - **READ THIS FIRST!**
- [Feishu Card Documentation](https://open.feishu.cn/document/ukTMukTMukTM/uczM3QjL3MzN04yNzcDN)
- [OpenClaw Docs](https://docs.openclaw.ai)

---

## Game Download Workflow (游戏下载流程)

This skill includes a complete game download workflow for FitGirl repacks.

### Prerequisites (前置条件)

**必须配置 Peekaboo Bridge：**
```bash
# 1. 启用 OpenClaw 的 Peekaboo Bridge
#    打开 OpenClaw.app → Settings → 勾选 Peekaboo Bridge

# 2. 授权权限（系统设置）
#    系统设置 → 隐私与安全性
#    ├── 辅助功能 → 勾选 OpenClaw
#    ├── 屏幕录制 → 勾选 OpenClaw
#    └── Apple Events → 可选（非必须，建议开启）

# 3. 检查 Bridge 状态
peekaboo bridge status --verbose
# 期望: perm: SR=Y AX=Y（AS 可为 N）
```

### Workflow

```
1. 用户: "下载游戏 XXX"
   ↓
2. 尝试在 FitGirl 搜索
   ↓
3. 如果找到 → 发送下载卡片
   ↓
4. 用户点击 "开始下载"
   ↓
5. 检测 Thunder + Peekaboo 权限
   ↓
6. 选择/确认下载文件夹
   ↓
7. 自动打开 magnet + Peekaboo 点击“立即下载”
   ↓
8. 出现“已保存到云端”提示（成功）

### 与搜索的区别

| 功能 | feishu-game-search | feishu-interactive-cards |
|------|-------------------|--------------------------|
| **输入** | "搜索游戏 XXX" | "下载游戏 XXX" |
| **搜索** | 只搜索，返回信息卡片 | 搜索 + 确认后直接下载 |
| **确认** | 需要用户确认名称 | 可选确认下载文件夹 |
| **结果** | 查看信息 | 自动下载 |

### 协作流程

```
用户: "搜索游戏 The Alters"
→ feishu-game-search: 返回游戏信息卡片

用户: "下载 The Alters"  
→ feishu-interactive-cards: 直接开始下载流程
```

### Scripts

| 脚本 | 功能 |
|------|------|
| `send-game-card.js` | 发送游戏下载卡片（自动提取图片和 magnet） |
| `card-callback-server.js` | 处理按钮回调，执行下载 |
| `thunder-download.sh` | 下载入口脚本（优先调用 Peekaboo 方案） |
| `thunder-download-peekaboo.sh` | **Peekaboo 自动点击（动态坐标 + 文本回退 + 云端提示验收）** |
| `thunder-cloud-game-refresh.sh` | **云盘验收脚本：see->云盘->双击 Game->点击右上刷新按钮->检查游戏名** |

### Usage

```bash
# 发送游戏下载卡片
cd /Users/ella/.openclaw/workspace/skills/feishu-interactive-cards/scripts
node send-game-card.js \
  --game "The Alters (多重人生)" \
  --genres "3D, 冒险, 制作" \
  --size "47.4GB" \
  --date "2025-06-14" \
  --magnet "magnet:?xt=urn:btih:..." \
  --page "https://fitgirl-repacks.site/the-alters/" \
  --chat-id ou_xxx

# 或使用 Peekaboo 自动点击（推荐）
./thunder-download-peekaboo.sh "magnet:?xt=urn:btih:..."
```

### Success Criteria (成功判定)

以迅雷弹窗提示为准：

- 出现 `已保存到云端` / `已添加到云盘` 文案 => 视为成功
- 若提示瞬时消失，脚本会做短轮询检测并输出结果
- 若弹窗标题为“添加到云盘”，脚本会优先点击 `下载` 按钮（云盘模式）

云盘二次验收（推荐执行）：

- 运行 `thunder-cloud-game-refresh.sh "<游戏名关键字>"`  
- 验证顺序固定为：`see` 当前页面 -> 点击左侧`云盘` -> `see` -> 双击`Game` -> `see` -> 点击右上角刷新按钮 -> `see`
- 刷新按钮采用已验证的右上圆形第 2 个按钮（常见元素 id: `elem_59`），再回退文本匹配
- 刷新后页面出现目标游戏名，即判定“已保存到云盘”成功

### Callback Actions

| Action | 说明 |
|--------|------|
| `start_download` | 开始下载流程 |
| `change_folder` | 更换下载文件夹 |
| `set_folder` | 设置并保存文件夹 |
| `confirm_download` | 确认下载 |
| `manual_download` | 手动下载（显示 magnet 链接） |

### Download Preferences

下载文件夹偏好保存在 `~/.openclaw/download_prefs.json`：

```json
{
  "folder": "/Users/ella/Downloads",
  "lastUpdated": "2026-02-10T12:00:00.000Z"
}
```

### Requirements

- **Thunder 下载器**（用于 BT 下载）
- **Peekaboo Bridge**（用于自动点击下载按钮，权限已配置）
- **OpenClaw.app**（托管 Peekaboo Bridge）
- 飞书应用权限已配置

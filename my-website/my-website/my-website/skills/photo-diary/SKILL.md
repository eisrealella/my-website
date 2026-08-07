# Photo Diary Skill 📸

## Overview
照片日记技能，已沉淀为两条稳定链路：
1. **真实拍照记录**（`imagesnap` + OpenClaw `nodes run`）
2. **灰蓝磨砂玻璃画廊**（HTML in Canvas）

## 功能
1. 拍照记录 - 保存真实照片和日记内容
2. 画廊展示 - 卡片画廊（标题、时间、图片、心情、标签）
3. 兜底展示 - A2UI JSONL（当 HTML 不可用时）

## 关键文件
- `/Users/ella/.openclaw/workspace/skills/photo-diary/scripts/photo-diary.js`
- `/Users/ella/.openclaw/workspace/skills/photo-diary/scripts/render-gallery-html.js`
- `/Users/ella/.openclaw/canvas/diary-gallery-shadcn.html`

## 当前默认视觉
- **主题**: 灰蓝色磨砂玻璃
- **风格**: 深色舞台背景 + 透明玻璃卡片 + 轻动态光斑
- **适配**: macOS Canvas（OpenClaw）

## 标准流程（推荐）

### A. 真实拍照并入库
```bash
openclaw nodes run --node "1ea4c2ade2f2a9b176030073c4e2bc66feb15ff46047a2396cefb8b4fb4146a8" --security full --ask off --raw "imagesnap -w 1 '$HOME/.openclaw/photo-diary/photos/shot-$(date +%Y%m%d-%H%M%S).jpg'"
```

### B. 生成灰蓝磨砂 HTML 画廊
```bash
node /Users/ella/.openclaw/workspace/skills/photo-diary/scripts/render-gallery-html.js
```

### C. 在 Canvas 展示 HTML 画廊
```bash
openclaw gateway call node.invoke --json --params '{"nodeId":"<NODE_ID>","command":"canvas.present","params":{"url":"http://127.0.0.1:18789/__openclaw__/canvas/diary-gallery-shadcn.html"},"idempotencyKey":"diary-html-present"}'
```

## A2UI 兜底流程（备用）
1. 生成 JSONL：
```bash
node /Users/ella/.openclaw/workspace/skills/photo-diary/scripts/photo-diary.js gallery
```
2. `canvas.a2ui.reset` + `canvas.a2ui.pushJSONL`

## 注意事项
- 如果出现 `waiting for A2UI messages...`：优先用 HTML 画廊 `canvas.present` 恢复。
- 若网关偶发 `1006`：重试 `gateway restart` 后再推送。
- 节点当前未暴露 `camera.snap`，真实拍照通过 `system.run/imagesnap` 已可稳定使用。

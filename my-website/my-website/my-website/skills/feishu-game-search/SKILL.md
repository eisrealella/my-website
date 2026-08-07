# feishu-game-search Skill (v1.2.0)

在 Steam 搜索游戏信息，返回完整的游戏介绍卡片。

## 触发方式（支持自然语言）

在飞书中输入以下任意方式：

```
搜索游戏 [名称]
搜一下 [名称]
帮我搜 [名称]
[名称] 价格
[名称] Steam
[名称] 多少钱
查一下 [名称]
看看 [名称]
```

例如：
- `搜索游戏 The Alters`
- `搜一下 极乐disco`
- `极乐迪斯科 价格`
- `Disco Elysium 现在多少钱`

## 智能搜索流程（v1.2.0 优化）

```
1. 直接 Steam 搜索
   └── 成功 → 返回卡片
   
2. 如果失败，Google 确认英文名
   └──神之天平案例：中文名"神之天平" → 英文名"ASTLIBRA Revision"
   └── 直译"Divine Atlas" 搜不到！
   └── Google 搜索后用正确英文名搜索
   
3. 如果都失败，返回确认卡片
   └── 让用户告知正确的英文名或 Steam 链接
```

## 输出卡片格式

**卡片内容：**
- 🎮 **游戏名称** + Steam 封面图（清晰 CDN 首图）
- ⭐ **评分**（极度好评/好评如潮等）
- 💯 **Metacritic**（如果有）
- 💰 **价格**（当前 Steam 价格）
- 🏷️ **类型**（角色扮演/动作等）

**关于这款游戏：**
- 完整中文描述（Steam 官方简介）
- 游戏特色亮点（3-5 条）

**语言支持：**
- ✅ 繁体中文 / ✅ 简体中文 / ✅ 英文
- 标注是否支持中文界面/语音/字幕

**链接：**
- 🔗 Steam 商店链接（纯文本，避免按钮问题）
- 📦 FitGirl 下载页（如果有）
- 🧲 Magnet 链接（如果有）

## 重要优化（神之天平案例后）

### Steam URL 格式
```
https://store.steampowered.com/search?term={游戏名}&ndl=1
```
- **必须加 `&ndl=1`** - 排除 DLC 过滤，显示更完整结果
- **不要加 `/`** - `search?` 而不是 `search/?`

### 不要直译游戏名！
- ❌ 神之天平 → Divine Atlas（搜不到）
- ✅ 神之天平 → Google 确认 → ASTLIBRA Revision（能搜到）

### 搜索策略
1. 先直接搜索用户输入
2. 如果失败，用 Google 确认正确的英文名
3. 用正确英文名重试
4. 都失败则返回确认卡片

## 技术实现

### Steam 首图获取
```
URL: https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg
```
- 不要截图，直接用 CDN URL
- 图片清晰（~60KB）

### Steam 搜索
```
URL: https://store.steampowered.com/search?term={游戏名}&ndl=1
```
- 必须用 `&ndl=1` 参数
- 不要加语言筛选

### 图片上传流程
1. curl/wget 下载 CDN 图片
2. POST 到 `https://open.feishu.cn/open-apis/im/v1/images`
3. 获取 img_key 发送到卡片

## 与下载的区别

| 功能 | feishu-game-search | feishu-interactive-cards |
|------|--------------------|--------------------------|
| **用途** | 搜索 + 展示信息 | 下载游戏 |
| **触发词** | "搜/查/价格/Steam" | "下载" |
| **输出** | 游戏介绍卡片 | 下载流程 |

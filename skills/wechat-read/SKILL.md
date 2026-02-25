# 微信读书 (WeChat Read) Skill

## 概述
通过浏览器控制微信读书网页版。

## 网址
- 首页：https://weread.qq.com/
- 书籍：https://weread.qq.com/web/reader/{bookId}

## 操作命令

### 打开书籍
```json
{
  "action": "navigate",
  "targetUrl": "https://weread.qq.com/web/reader/821320d0813ab9891g0130d0"
}
```

### 翻页
```json
{
  "action": "act",
  "request": {"kind": "press", "key": "ArrowRight"}
}
```

### 读目录
```json
{
  "action": "act",
  "request": {"kind": "click", "ref": "e44"}  // 目录按钮
}
```

### 截图当前页
```json
{
  "action": "screenshot"
}
```

## Book ID 获取
- 从书架点击书籍后的 URL 中提取
- 格式：`https://weread.qq.com/web/reader/XXXXXXXX`

## 快捷指令
- "打开心智社会" → 导航到书籍
- "下一页" → ArrowRight
- "上一页" → ArrowLeft  
- "目录" → 点击目录按钮
- "读当前页" → screenshot + OCR

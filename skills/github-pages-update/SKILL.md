# Website Update Skill

## 场景
更新 GitHub Pages 网站后，需要验证：
1. 本地 index.html 内容正确
2. GitHub 仓库内容正确
3. GitHub Pages 构建完成

## 验证步骤

### 1. 检查本地 index.html
```bash
# 查看标题是否正确
grep "<title>" index.html
```

### 2. 检查 GitHub 仓库
```bash
# 用 gh API 查看仓库内容
gh api repos/{owner}/{repo}/contents/index.html --jq '.content' | base64 -d | head -10

# 或查看 git tree 的 hash
gh api "repos/{owner}/{repo}/git/trees/main?recursive=1" --jq '.tree[] | select(.path=="index.html")'
```

### 3. 检查 GitHub Pages 构建状态
```bash
# 查看最新构建
gh api repos/{owner}/{repo}/pages/builds --jq '.[0] | {status: .status, commit: .commit}'

# 触发重新构建（如果需要）
cd repo && git commit --allow-empty -m "trigger rebuild" && git push
```

### 4. 验证网站内容
```bash
# 直接 curl 网站
curl -s https://{username}.github.io/{repo}/ | grep "<title>"
```

## 常见问题

### 问题：GitHub 上是旧内容
**原因**：Git commit 没有真正更新文件（可能被 git 的 safe directory 或缓存问题影响）

**解决方案**：
1. 删除本地文件重新创建
2. 强制推送：`git push -f origin main`

### 问题：构建状态是旧 commit
**解决方案**：
```bash
git commit --allow-empty -m "trigger rebuild"
git push
```

### 问题：Pages 缓存
**解决方案**：等待几分钟后刷新，或触发新的 commit 强制重建

## 更新后推送 Skill 到 GitHub

```bash
cd ~/openclaw/workspace
git add skills/github-pages-update/
git commit -m "update: github-pages-update skill"
git push
```

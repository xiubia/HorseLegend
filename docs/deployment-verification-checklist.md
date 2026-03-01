# GitHub Pages 部署验证清单

快速参考卡片，用于验证 GitHub Actions 部署工作流。

## 🚀 快速开始

### 1️⃣ 本地验证（5 分钟）

```bash
# 验证配置
npm run verify-deployment

# 构建项目
npm run build

# 本地预览
npm run preview
```

访问 http://localhost:4173 确认游戏正常运行。

### 2️⃣ GitHub Actions 验证（10 分钟）

```bash
# 创建测试分支
git checkout -b test/github-actions-deployment

# 推送到 GitHub
git push -u origin test/github-actions-deployment

# 在 GitHub 上创建 PR 并合并到 main
```

详细步骤请参考：[GitHub Actions 验证指南](./github-actions-verification.md)

### 3️⃣ 部署验证（5 分钟）

1. 在 GitHub 仓库的 Actions 标签查看工作流运行状态
2. 确认构建和部署作业都成功完成（绿色勾号）
3. 检查 gh-pages 分支是否已创建
4. 访问 `https://[username].github.io/HorseLegend/`

## ✅ 验证清单

### 配置验证

- [ ] `vite.config.ts` 配置正确（base path = `/HorseLegend/`）
- [ ] `.github/workflows/deploy.yml` 存在且配置正确
- [ ] `package.json` 包含 build 和 preview 脚本
- [ ] 运行 `npm run verify-deployment` 全部通过

### 本地验证

- [ ] `npm run build` 成功完成，无错误
- [ ] `dist` 目录包含 `index.html` 和 `assets/`
- [ ] `npm run preview` 启动成功
- [ ] 本地预览游戏正常运行
- [ ] 浏览器控制台无错误

### GitHub 配置验证

- [ ] 仓库 Settings → Actions → General → Workflow permissions 设置为 "Read and write permissions"
- [ ] 仓库 Settings → Pages → Source 设置为 "Deploy from a branch"
- [ ] 仓库 Settings → Pages → Branch 设置为 "gh-pages" / "/ (root)"

### 工作流验证

- [ ] 推送到 main 分支后工作流自动触发
- [ ] Build 作业所有步骤成功（绿色勾号）
  - [ ] Checkout code
  - [ ] Setup Node.js
  - [ ] Install dependencies
  - [ ] Build project
  - [ ] Upload build artifacts
- [ ] Deploy 作业所有步骤成功（绿色勾号）
  - [ ] Download build artifacts
  - [ ] Deploy to GitHub Pages

### 部署验证

- [ ] `gh-pages` 分支已创建
- [ ] `gh-pages` 分支包含构建产物
- [ ] GitHub Pages URL 可访问
- [ ] 游戏在部署的网站上正常运行
- [ ] 所有资源正确加载（无 404）
- [ ] 资源路径包含 `/HorseLegend/` 前缀
- [ ] 文件名包含内容哈希（如 `main-abc123.js`）

## 🔧 快速故障排查

### 问题：工作流没有触发

```bash
# 检查工作流配置
cat .github/workflows/deploy.yml | grep -A 3 "on:"

# 确认在 main 分支
git branch --show-current
```

### 问题：构建失败

```bash
# 本地复现
npm ci
npm run build

# 查看详细错误
npm run build 2>&1 | tee build.log
```

### 问题：部署失败

1. 检查 Settings → Actions → General → Workflow permissions
2. 确保选择 "Read and write permissions"
3. 重新运行工作流

### 问题：网站 404

```bash
# 检查 gh-pages 分支
git fetch origin
git checkout gh-pages
ls -la

# 检查 base path 配置
grep "base:" vite.config.ts
```

### 问题：资源加载失败

1. 打开浏览器开发者工具（F12）
2. 查看 Network 标签中失败的请求
3. 检查请求 URL 是否包含 `/HorseLegend/` 前缀
4. 验证 `vite.config.ts` 中的 base 配置

## 📚 详细文档

- [部署配置指南](./deployment.md) - 完整的部署配置说明
- [GitHub Actions 验证指南](./github-actions-verification.md) - 详细的验证步骤
- [Vite 配置文档](https://vitejs.dev/config/) - Vite 官方文档

## 🎯 成功标准

所有以下条件都满足时，验证成功：

1. ✅ 本地构建和预览正常
2. ✅ GitHub Actions 工作流成功运行
3. ✅ gh-pages 分支正确创建和更新
4. ✅ GitHub Pages 网站可访问
5. ✅ 游戏在部署的网站上正常运行
6. ✅ 所有资源正确加载

## 🚨 注意事项

1. **首次部署**：需要在 GitHub 仓库设置中手动启用 GitHub Pages
2. **权限配置**：必须设置 "Read and write permissions" 才能推送到 gh-pages 分支
3. **部署延迟**：GitHub Pages 部署可能需要 1-2 分钟才能生效
4. **缓存问题**：如果看到旧版本，尝试强制刷新（Ctrl+Shift+R）

## 💡 提示

- 使用 `npm run verify-deployment` 快速检查配置
- 在本地预览环境测试后再推送到 GitHub
- 查看 Actions 标签的详细日志排查问题
- 保持 main 分支稳定，使用分支进行测试

---

**完成验证后，请在任务清单中标记任务 9.1 为完成。**

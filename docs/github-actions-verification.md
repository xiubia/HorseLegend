# GitHub Actions 工作流验证指南

本指南将帮助你验证 GitHub Pages 部署工作流是否正确配置并能成功运行。

## 前置条件

在开始验证之前，请确保：

1. ✅ 已完成所有前置任务（1-8）
2. ✅ 本地构建成功（`npm run build`）
3. ✅ 本地预览正常（`npm run preview`）
4. ✅ 所有测试通过
5. ✅ 代码已提交到本地 Git 仓库

## 验证步骤

### 步骤 1：创建测试分支

创建一个测试分支用于验证工作流，避免直接在 main 分支上测试：

```bash
# 确保在 main 分支上
git checkout main

# 创建并切换到测试分支
git checkout -b test/github-actions-deployment

# 确认当前分支
git branch
```

**预期结果**：当前分支显示为 `test/github-actions-deployment`

### 步骤 2：推送测试分支到 GitHub

```bash
# 推送测试分支到远程仓库
git push -u origin test/github-actions-deployment
```

**预期结果**：
- 命令成功执行，无错误信息
- 输出显示分支已推送到远程

**注意**：此时工作流**不会**触发，因为工作流配置为只在 `main` 分支触发。

### 步骤 3：在 GitHub 上创建 Pull Request

1. 打开浏览器，访问你的 GitHub 仓库
2. 点击 "Pull requests" 标签
3. 点击 "New pull request" 按钮
4. 设置：
   - Base: `main`
   - Compare: `test/github-actions-deployment`
5. 点击 "Create pull request"
6. 填写 PR 标题：`Test: Verify GitHub Actions deployment workflow`
7. 填写描述：
   ```
   验证 GitHub Actions 部署工作流是否正确配置。
   
   验证项：
   - [ ] 工作流自动触发
   - [ ] 构建作业成功完成
   - [ ] 部署作业成功完成
   - [ ] gh-pages 分支正确更新
   ```
8. 点击 "Create pull request"

### 步骤 4：合并 PR 触发工作流

**重要**：在合并前，请确保你已经在 GitHub 仓库设置中启用了必要的权限。

#### 4.1 检查仓库权限设置

1. 进入仓库的 "Settings" 页面
2. 点击左侧菜单的 "Actions" → "General"
3. 滚动到 "Workflow permissions" 部分
4. 确保选择了 "Read and write permissions"
5. 勾选 "Allow GitHub Actions to create and approve pull requests"
6. 点击 "Save" 保存设置

#### 4.2 合并 Pull Request

1. 在 PR 页面，点击 "Merge pull request" 按钮
2. 选择 "Create a merge commit"
3. 点击 "Confirm merge"

**预期结果**：
- PR 成功合并到 main 分支
- GitHub Actions 工作流自动触发

### 步骤 5：监控工作流执行

#### 5.1 查看工作流运行状态

1. 在仓库页面，点击 "Actions" 标签
2. 你应该看到一个新的工作流运行，名称为 "Deploy to GitHub Pages"
3. 点击该工作流运行查看详情

#### 5.2 验证构建作业（Build Job）

1. 在工作流详情页面，点击 "Build" 作业
2. 展开各个步骤，检查执行日志
3. 验证以下步骤都成功完成（绿色勾号）：
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build project
   - ✅ Upload build artifacts

**关键检查点**：
- "Build project" 步骤应该显示 TypeScript 编译成功
- 应该看到 Vite 构建输出，包括文件大小统计
- 没有错误或警告信息

#### 5.3 验证部署作业（Deploy Job）

1. 返回工作流详情页面，点击 "Deploy" 作业
2. 展开各个步骤，检查执行日志
3. 验证以下步骤都成功完成：
   - ✅ Download build artifacts
   - ✅ Deploy to GitHub Pages

**关键检查点**：
- "Deploy to GitHub Pages" 步骤应该显示成功推送到 gh-pages 分支
- 应该看到类似 "Published" 的成功消息

### 步骤 6：验证 gh-pages 分支

#### 6.1 检查分支是否创建

1. 在仓库页面，点击分支下拉菜单（默认显示 "main"）
2. 在分支列表中查找 "gh-pages" 分支
3. 切换到 gh-pages 分支查看内容

**预期结果**：
- gh-pages 分支存在
- 分支包含构建产物（index.html, assets/ 等）
- 文件结构与本地 dist 目录一致

#### 6.2 使用命令行验证

```bash
# 获取最新的远程分支信息
git fetch origin

# 查看 gh-pages 分支
git checkout gh-pages

# 列出文件
ls -la

# 查看最近的提交
git log -1
```

**预期结果**：
- 成功切换到 gh-pages 分支
- 看到 index.html 和 assets 目录
- 最近的提交由 "github-actions[bot]" 创建

### 步骤 7：配置 GitHub Pages

如果这是第一次部署，需要配置 GitHub Pages 设置：

1. 进入仓库的 "Settings" 页面
2. 点击左侧菜单的 "Pages"
3. 在 "Source" 部分：
   - 选择 "Deploy from a branch"
   - Branch: 选择 "gh-pages"
   - Folder: 选择 "/ (root)"
4. 点击 "Save"

**预期结果**：
- 页面顶部显示 "Your site is live at https://[username].github.io/HorseLegend/"
- 可能需要等待几分钟才能访问

### 步骤 8：访问部署的网站

1. 等待 1-2 分钟让 GitHub Pages 完成部署
2. 访问显示的 URL：`https://[username].github.io/HorseLegend/`

**预期结果**：
- ✅ 页面成功加载，显示游戏界面
- ✅ 没有 404 错误
- ✅ 浏览器控制台没有资源加载错误
- ✅ 游戏能正常运行

### 步骤 9：验证资源加载

打开浏览器开发者工具（F12），检查：

#### 9.1 Network 标签

1. 刷新页面
2. 查看 Network 标签中的请求
3. 验证所有资源请求都成功（状态码 200）
4. 特别检查：
   - JavaScript 文件（应该包含哈希值）
   - CSS 文件（如果有）
   - Assets 目录下的资源（模型、纹理、音频）

**预期结果**：
- 所有资源路径都包含 `/HorseLegend/` 前缀
- 没有 404 错误
- 资源文件名包含哈希值（如 `main-abc123.js`）

#### 9.2 Console 标签

1. 查看控制台输出
2. 确认没有错误信息（红色）
3. 警告信息（黄色）可以接受，但需要记录

**预期结果**：
- 没有资源加载失败的错误
- 没有路径相关的错误

### 步骤 10：清理测试分支（可选）

验证完成后，可以删除测试分支：

```bash
# 切换回 main 分支
git checkout main

# 删除本地测试分支
git branch -D test/github-actions-deployment

# 删除远程测试分支
git push origin --delete test/github-actions-deployment
```

## 验证清单

完成所有步骤后，请确认以下所有项都已验证：

- [ ] 测试分支成功创建并推送
- [ ] Pull Request 成功创建
- [ ] 工作流在合并后自动触发
- [ ] 构建作业成功完成（所有步骤绿色）
- [ ] 部署作业成功完成（所有步骤绿色）
- [ ] gh-pages 分支已创建并包含正确内容
- [ ] GitHub Pages 已配置并启用
- [ ] 部署的网站可以访问
- [ ] 游戏在部署的网站上正常运行
- [ ] 所有资源正确加载（无 404 错误）
- [ ] 资源路径包含正确的 base path
- [ ] 文件名包含内容哈希

## 常见问题排查

### 问题 1：工作流没有触发

**可能原因**：
- 工作流配置文件有语法错误
- 推送的不是 main 分支
- 仓库没有启用 Actions

**解决方案**：
1. 检查 `.github/workflows/deploy.yml` 语法
2. 确认推送到 main 分支
3. 进入 Settings → Actions → General，确保 Actions 已启用

### 问题 2：构建作业失败

**可能原因**：
- 依赖安装失败
- TypeScript 编译错误
- Vite 构建错误

**解决方案**：
1. 查看失败步骤的详细日志
2. 在本地运行 `npm ci && npm run build` 复现问题
3. 修复错误后重新推送

### 问题 3：部署作业失败

**可能原因**：
- 权限不足
- gh-pages 分支推送失败

**解决方案**：
1. 检查 Settings → Actions → General → Workflow permissions
2. 确保选择了 "Read and write permissions"
3. 检查 GITHUB_TOKEN 是否有效

### 问题 4：网站无法访问（404）

**可能原因**：
- GitHub Pages 未正确配置
- 部署尚未完成
- base path 配置错误

**解决方案**：
1. 检查 Settings → Pages 配置
2. 等待几分钟后重试
3. 检查 vite.config.ts 中的 base 配置

### 问题 5：资源加载失败

**可能原因**：
- base path 配置错误
- 资源路径不正确
- 文件未包含在构建产物中

**解决方案**：
1. 检查浏览器控制台的错误信息
2. 验证 vite.config.ts 中的 base 配置为 `/HorseLegend/`
3. 检查 dist 目录是否包含所需资源
4. 确认资源引用使用相对路径

## 后续步骤

验证成功后：

1. ✅ 标记任务 9.1 为完成
2. 📝 记录验证结果和任何发现的问题
3. 🎉 GitHub Pages 部署功能已就绪！

现在，每次推送到 main 分支时，游戏都会自动部署到 GitHub Pages。

## 自动化验证脚本（可选）

如果你想自动化部分验证步骤，可以使用以下脚本：

```bash
#!/bin/bash
# verify-deployment.sh

echo "🔍 验证 GitHub Pages 部署..."

# 检查 gh-pages 分支是否存在
if git ls-remote --heads origin gh-pages | grep -q gh-pages; then
    echo "✅ gh-pages 分支存在"
else
    echo "❌ gh-pages 分支不存在"
    exit 1
fi

# 检查最近的工作流运行状态（需要 GitHub CLI）
if command -v gh &> /dev/null; then
    echo "📊 检查最近的工作流运行..."
    gh run list --workflow=deploy.yml --limit=1
else
    echo "⚠️  未安装 GitHub CLI，跳过工作流状态检查"
fi

echo "✅ 验证完成！"
```

使用方法：

```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

**注意**：此脚本需要安装 [GitHub CLI](https://cli.github.com/) 才能检查工作流状态。

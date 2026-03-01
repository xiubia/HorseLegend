# HorseLegend 部署指南

本文档说明如何将 HorseLegend 3D 游戏项目部署到 GitHub Pages，使其可以通过公开 URL 访问。

## 目录

- [前置要求](#前置要求)
- [GitHub 仓库配置](#github-仓库配置)
- [自动部署配置](#自动部署配置)
- [手动部署步骤](#手动部署步骤)
- [本地预览方法](#本地预览方法)
- [故障排查指南](#故障排查指南)

## 前置要求

在开始部署之前，请确保满足以下要求：

### 软件环境

- **Node.js**: 版本 18.0.0 或更高
  ```bash
  node --version  # 检查版本
  ```

- **npm**: 通常随 Node.js 一起安装
  ```bash
  npm --version  # 检查版本
  ```

- **Git**: 用于版本控制和代码推送
  ```bash
  git --version  # 检查版本
  ```

### Git 配置

确保已配置 Git 用户信息：

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### GitHub 账号

- 拥有 GitHub 账号
- 对目标仓库有写入权限
- 仓库已推送到 GitHub

## GitHub 仓库配置

### 1. 启用 GitHub Pages

1. 打开 GitHub 仓库页面
2. 点击 **Settings**（设置）标签
3. 在左侧菜单中找到 **Pages**
4. 在 **Source** 部分：
   - 选择 **Deploy from a branch**
   - Branch 选择 **gh-pages**
   - 目录选择 **/ (root)**
5. 点击 **Save**（保存）

### 2. 配置 GitHub Actions 权限

为了让 GitHub Actions 能够自动部署，需要配置正确的权限：

1. 在仓库的 **Settings** 页面
2. 在左侧菜单中找到 **Actions** → **General**
3. 滚动到 **Workflow permissions** 部分
4. 选择 **Read and write permissions**
5. 勾选 **Allow GitHub Actions to create and approve pull requests**（可选）
6. 点击 **Save**（保存）

### 3. 验证配置

配置完成后，GitHub Pages 的 URL 将显示在 Pages 设置页面顶部：

```
Your site is published at https://<username>.github.io/<repository-name>/
```

记下这个 URL，稍后可以用它访问部署的游戏。

## 自动部署配置

项目已配置 GitHub Actions 工作流，可以在代码推送到 `main` 分支时自动构建和部署。

### 工作流文件

工作流配置文件位于 `.github/workflows/deploy.yml`，包含以下步骤：

1. **检出代码**：从仓库拉取最新代码
2. **设置 Node.js**：安装 Node.js 18.x 环境
3. **安装依赖**：执行 `npm ci` 安装项目依赖
4. **构建项目**：执行 `npm run build` 生成生产版本
5. **部署到 GitHub Pages**：将构建产物推送到 `gh-pages` 分支

### 触发自动部署

只需将代码推送到 `main` 分支即可触发自动部署：

```bash
git add .
git commit -m "Update game features"
git push origin main
```

### 查看部署状态

1. 在 GitHub 仓库页面，点击 **Actions** 标签
2. 查看最新的工作流运行记录
3. 点击具体的运行记录可以查看详细日志
4. 绿色勾号表示部署成功，红色叉号表示失败

部署通常需要 2-5 分钟完成。成功后，访问 GitHub Pages URL 即可看到更新后的游戏。

## 手动部署步骤

如果需要手动部署（例如在没有配置 GitHub Actions 的情况下），可以按照以下步骤操作：

### 1. 本地构建

在项目根目录执行构建命令：

```bash
npm run build
```

构建成功后，生产版本文件将生成在 `dist` 目录中。

### 2. 安装 gh-pages 工具（首次）

如果是首次手动部署，需要安装 `gh-pages` 工具：

```bash
npm install -g gh-pages
```

或者作为开发依赖安装：

```bash
npm install --save-dev gh-pages
```

### 3. 部署到 GitHub Pages

使用 `gh-pages` 工具将 `dist` 目录部署到 `gh-pages` 分支：

```bash
gh-pages -d dist
```

或者添加到 `package.json` 的 scripts 中：

```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

然后执行：

```bash
npm run deploy
```

### 4. 验证部署

部署完成后，访问 GitHub Pages URL 验证游戏是否正常运行。

## 本地预览方法

在部署前，建议先在本地预览生产构建版本，以确保一切正常。

### 构建并预览

```bash
# 1. 构建生产版本
npm run build

# 2. 启动预览服务器
npm run preview
```

预览服务器将在 `http://localhost:4173` 启动。

### 预览环境说明

- 预览环境模拟 GitHub Pages 的路径配置
- 所有资源路径与部署版本一致
- 可以验证游戏功能和资源加载是否正常

### 测试检查清单

在本地预览时，建议检查以下内容：

- [ ] 游戏页面能正常加载
- [ ] 3D 场景正确渲染
- [ ] 3D 模型文件正确加载
- [ ] 纹理贴图正确显示
- [ ] 音频文件能正常播放
- [ ] 游戏交互功能正常
- [ ] 浏览器控制台无错误信息

## 故障排查指南

### 常见问题及解决方案

#### 1. 构建失败：TypeScript 编译错误

**症状**：
```
error TS2304: Cannot find name 'XXX'
```

**解决方案**：
- 检查 TypeScript 代码语法错误
- 确保所有依赖已正确安装：`npm install`
- 检查 `tsconfig.json` 配置是否正确
- 运行 `npm run dev` 在开发环境中定位问题

#### 2. 构建失败：Vite 打包错误

**症状**：
```
[vite]: Rollup failed to resolve import
```

**解决方案**：
- 检查导入路径是否正确
- 确保导入的文件存在
- 检查文件扩展名是否正确（.ts, .js）
- 清除缓存后重试：`rm -rf node_modules/.vite && npm run build`

#### 3. GitHub Actions 权限错误

**症状**：
```
Error: Resource not accessible by integration
```

**解决方案**：
- 检查 GitHub Actions 权限配置（参见 [配置 GitHub Actions 权限](#2-配置-github-actions-权限)）
- 确保选择了 "Read and write permissions"
- 重新运行工作流

#### 4. 部署后页面空白

**症状**：访问 GitHub Pages URL 显示空白页面

**可能原因及解决方案**：

**原因 1：Base path 配置错误**
- 检查 `vite.config.ts` 中的 `base` 配置
- 确保生产环境使用仓库名作为 base path：`/HorseLegend/`
- 重新构建并部署

**原因 2：资源路径错误**
- 打开浏览器开发者工具（F12）
- 查看 Console 和 Network 标签
- 检查是否有 404 错误
- 确保资源路径使用相对路径或正确的 base path

**原因 3：GitHub Pages 未启用**
- 检查仓库 Settings → Pages 配置
- 确保选择了 `gh-pages` 分支
- 等待几分钟让 GitHub Pages 生效

#### 5. 资源文件 404 错误

**症状**：
```
GET https://username.github.io/HorseLegend/assets/models/horse.glb 404
```

**解决方案**：
- 检查资源文件是否存在于 `assets` 目录
- 确保资源文件路径大小写正确（GitHub Pages 区分大小写）
- 检查 `.gitignore` 是否误排除了资源文件
- 确保资源文件已提交到 Git 仓库
- 重新构建并部署

#### 6. 部署后游戏功能异常

**症状**：游戏在本地运行正常，但部署后功能异常

**解决方案**：
- 使用 `npm run preview` 在本地测试生产构建版本
- 检查浏览器控制台错误信息
- 检查是否使用了开发环境特有的功能
- 确保所有环境变量正确配置
- 检查是否有硬编码的本地路径

#### 7. 构建产物过大

**症状**：构建时间长，部署慢，加载慢

**解决方案**：
- 检查是否误将 `node_modules` 或其他大文件包含在构建中
- 优化资源文件大小（压缩纹理、模型）
- 使用 CDN 加载大型第三方库
- 检查 Vite 配置的代码分割策略
- 运行 `npm run build` 查看构建产物大小统计

#### 8. 工作流运行缓慢

**症状**：GitHub Actions 工作流运行时间过长

**解决方案**：
- 使用 `npm ci` 而不是 `npm install`（已配置）
- 考虑添加依赖缓存（可选优化）
- 检查是否有不必要的构建步骤
- 优化构建配置以减少构建时间

### 调试技巧

#### 查看构建日志

本地构建时，Vite 会输出详细的构建信息：

```bash
npm run build
```

注意查看：
- 构建产物大小统计
- 警告和错误信息
- 资源文件处理情况

#### 查看 GitHub Actions 日志

1. 在 GitHub 仓库页面，点击 **Actions** 标签
2. 点击失败的工作流运行记录
3. 点击具体的作业（build 或 deploy）
4. 展开每个步骤查看详细日志
5. 查找错误信息和堆栈跟踪

#### 使用浏览器开发者工具

部署后访问 GitHub Pages URL，打开浏览器开发者工具（F12）：

- **Console**：查看 JavaScript 错误和日志
- **Network**：查看资源加载情况和 404 错误
- **Sources**：查看加载的文件和 source map
- **Application**：查看缓存和存储

### 获取帮助

如果以上方法无法解决问题，可以：

1. 检查项目的 GitHub Issues 是否有类似问题
2. 查看 Vite 官方文档：https://vitejs.dev/
3. 查看 GitHub Pages 文档：https://docs.github.com/pages
4. 在项目仓库创建 Issue 描述问题

## 附录

### 相关文件说明

- `vite.config.ts`：Vite 构建配置文件
- `.github/workflows/deploy.yml`：GitHub Actions 工作流配置
- `package.json`：项目依赖和脚本配置
- `dist/`：构建产物目录（不提交到 Git）

### 有用的命令

```bash
# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 清除缓存
rm -rf node_modules/.vite
rm -rf dist

# 重新安装依赖
rm -rf node_modules
npm install

# 查看 Git 状态
git status

# 查看远程仓库
git remote -v
```

### 环境变量

项目使用以下环境变量：

- `NODE_ENV`：运行环境（development / production）
- `BASE_URL`：Vite 注入的 base path（运行时可用）

在代码中可以通过 `import.meta.env.BASE_URL` 访问 base path。

---

**最后更新**：2024

如有问题或建议，欢迎提交 Issue 或 Pull Request。

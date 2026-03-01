# GitHub Pages 部署功能 - 设计文档

## 概述

本设计文档描述了如何为 HorseLegend 3D 游戏项目实现 GitHub Pages 部署功能。该功能将使游戏能够通过公开 URL 访问，让用户无需本地安装即可在浏览器中游玩。

### 设计目标

1. 配置 Vite 构建系统以支持 GitHub Pages 的子路径部署
2. 建立自动化 CI/CD 流程，实现代码推送后自动部署
3. 确保所有静态资源（3D 模型、纹理、音频）在部署后能正确加载
4. 提供本地预览能力，便于部署前验证
5. 优化构建产物，提升加载性能

### 技术约束

- 纯前端项目，不涉及后端服务
- 使用 Vite 作为构建工具
- 部署目标：GitHub Pages（静态托管）
- 资源路径必须支持子路径部署（`/<repository-name>/`）

## 架构

### 系统组件

```
┌─────────────────────────────────────────────────────────┐
│                    开发者工作流                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Git Push (main 分支)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions Workflow                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐      │
│  │ Checkout   │→ │ Build      │→ │ Deploy       │      │
│  │ 代码       │  │ (Vite)     │  │ (gh-pages)   │      │
│  └────────────┘  └────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  GitHub Pages 服务                       │
│              (https://user.github.io/repo/)             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ HTML/JS  │  │ Assets   │  │ Game     │             │
│  │ 加载     │→ │ 加载     │→ │ 运行     │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **Base Path 配置**：使用 Vite 的 `base` 选项配置仓库名作为路径前缀
2. **资源路径策略**：保持相对路径引用，由 Vite 自动处理 base path 注入
3. **部署分支**：使用独立的 `gh-pages` 分支存储构建产物
4. **CI/CD 工具**：使用 GitHub Actions 原生集成
5. **构建优化**：启用代码分割、压缩、哈希命名和 source map

## 组件和接口

### 1. Vite 配置文件 (vite.config.ts)

**职责**：配置构建系统的行为，包括 base path、构建优化、资源处理等。

**配置项**：

```typescript
interface ViteConfig {
  base: string                    // GitHub Pages 路径前缀
  build: {
    outDir: string               // 输出目录 (dist)
    assetsDir: string            // 资源目录名称
    sourcemap: boolean           // 生成 source map
    minify: 'terser' | boolean   // 代码压缩方式
    rollupOptions: {
      output: {
        manualChunks: object     // 代码分割策略
        assetFileNames: string   // 资源文件命名规则（含哈希）
        chunkFileNames: string   // chunk 文件命名规则（含哈希）
        entryFileNames: string   // 入口文件命名规则（含哈希）
      }
    }
  }
}
```

**关键配置**：
- `base`: 设置为 `process.env.NODE_ENV === 'production' ? '/HorseLegend/' : '/'`
- `build.sourcemap`: true（便于生产环境调试）
- `build.minify`: 'terser'（更好的压缩效果）
- 资源文件名包含内容哈希：`assets/[name]-[hash][extname]`

### 2. GitHub Actions Workflow (.github/workflows/deploy.yml)

**职责**：自动化构建和部署流程。

**工作流步骤**：

1. **触发条件**：
   - 事件：push 到 main 分支
   - 路径过滤：排除文档修改等非代码变更

2. **构建作业 (build job)**：
   - 检出代码
   - 设置 Node.js 环境（版本 18+）
   - 安装依赖：`npm ci`
   - 执行构建：`npm run build`
   - 上传构建产物（artifact）

3. **部署作业 (deploy job)**：
   - 依赖构建作业完成
   - 下载构建产物
   - 使用 `peaceiris/actions-gh-pages@v3` 部署到 gh-pages 分支

**权限要求**：
- `contents: write`（写入 gh-pages 分支）
- `pages: write`（部署到 GitHub Pages）

### 3. 资源加载器增强 (src/utils/AssetLoader.ts)

**当前实现**：
- 使用绝对路径或相对路径加载资源
- 内置缓存机制

**所需修改**：
无需修改。Vite 在构建时会自动处理资源路径，将相对路径转换为包含 base path 的正确路径。

**验证点**：
- 确保所有资源加载使用相对路径（如 `/assets/models/horse.glb`）
- Vite 会自动转换为 `/HorseLegend/assets/models/horse.glb`

### 4. 部署文档 (docs/deployment.md)

**职责**：提供部署配置和使用指南。

**内容结构**：
1. 前置要求
2. GitHub 仓库配置步骤
3. 自动部署配置
4. 手动部署步骤
5. 本地预览方法
6. 故障排查指南

## 数据模型

本功能主要涉及配置文件，不涉及运行时数据模型。

### 配置数据结构

**package.json 脚本**：
```json
{
  "scripts": {
    "dev": "vite --host",
    "build": "tsc && vite build",
    "preview": "vite preview --port 4173"
  }
}
```

**环境变量**：
- `NODE_ENV`: 'production' | 'development'
- `BASE_URL`: Vite 注入的 base path（运行时可用）

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：资源路径正确性

*对于任意*静态资源文件（模型、纹理、音频），构建后的引用路径都应该包含正确的 base path 前缀，且资源文件应该存在于 dist 目录的对应位置。

**验证：需求 1.3, 3.1**

### 属性 2：文件哈希命名规则

*对于任意*构建产物（JS、CSS、资源文件），其文件名都应该包含基于内容的哈希值，格式为 `[name]-[hash].[ext]` 或 `[name].[hash].[ext]`。

**验证：需求 6.4**

## 错误处理

### 构建阶段错误

| 错误类型 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| TypeScript 编译错误 | 构建失败，退出码非 0 | 显示编译错误详情 |
| Vite 打包错误 | 构建失败，退出码非 0 | 显示打包错误详情 |
| 资源文件缺失 | 构建警告，继续执行 | 显示缺失文件列表 |

### 部署阶段错误

| 错误类型 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| GitHub Actions 权限不足 | 工作流失败 | 提示配置权限 |
| gh-pages 分支推送失败 | 工作流失败 | 显示 Git 错误信息 |
| 网络超时 | 自动重试 3 次 | 显示重试进度 |

### 运行时错误

| 错误类型 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| 资源 404 错误 | AssetLoader 抛出异常 | 控制台错误日志 |
| 路径配置错误 | 页面加载失败 | 检查 base path 配置 |

## 测试策略

### 单元测试

单元测试用于验证具体示例和边缘情况：

1. **构建配置测试**：
   - 验证 vite.config.ts 导出正确的配置对象
   - 验证 base path 在不同环境下的值

2. **文件结构测试**：
   - 验证构建后 dist 目录包含必要文件（index.html、assets/）
   - 验证 assets 子目录结构与源目录一致

3. **文档完整性测试**：
   - 验证部署文档包含所有必需章节
   - 验证文档中的命令和配置示例正确

### 属性测试

属性测试用于验证通用规则，每个测试运行至少 100 次迭代：

1. **属性 1：资源路径正确性**
   ```typescript
   // Feature: github-pages-deployment, Property 1: 资源路径正确性
   // 对于任意静态资源文件，构建后的引用路径都应该包含正确的 base path
   ```
   - 生成随机资源文件路径
   - 执行构建
   - 验证构建产物中的引用路径包含 base path
   - 验证资源文件存在于 dist 目录

2. **属性 2：文件哈希命名规则**
   ```typescript
   // Feature: github-pages-deployment, Property 2: 文件哈希命名规则
   // 对于任意构建产物，其文件名都应该包含基于内容的哈希值
   ```
   - 执行构建
   - 遍历 dist 目录中的所有 JS/CSS 文件
   - 验证文件名匹配哈希命名模式
   - 修改源文件内容后重新构建，验证哈希值变化

### 集成测试

1. **本地预览测试**：
   - 执行 `npm run build && npm run preview`
   - 访问预览 URL
   - 验证游戏能正常加载和运行
   - 验证所有资源能正确加载

2. **GitHub Actions 测试**：
   - 创建测试分支
   - 推送代码触发工作流
   - 验证工作流成功完成
   - 验证 gh-pages 分支更新

### 手动测试

1. **部署验证**：
   - 访问 GitHub Pages URL
   - 验证游戏能正常运行
   - 测试不同浏览器的兼容性
   - 验证资源加载性能

2. **文档验证**：
   - 按照文档步骤执行配置
   - 验证所有命令和配置正确
   - 验证故障排查指南有效

### 测试工具

- **单元测试框架**：Vitest（与 Vite 原生集成）
- **属性测试库**：fast-check（TypeScript 生态的 PBT 库）
- **集成测试**：Playwright（浏览器自动化测试）
- **CI 环境**：GitHub Actions

### 测试配置

```typescript
// vitest.config.ts
export default {
  test: {
    // 属性测试最小迭代次数
    propertyTestIterations: 100,
    // 测试超时时间
    timeout: 10000,
  }
}
```

每个属性测试必须使用注释标记：
```typescript
// Feature: github-pages-deployment, Property 1: 资源路径正确性
```

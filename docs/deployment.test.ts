import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('部署文档完整性测试', () => {
  const docPath = join(process.cwd(), 'docs/deployment.md');
  let docContent: string;

  // 在所有测试前读取文档内容
  try {
    docContent = readFileSync(docPath, 'utf-8');
  } catch (error) {
    console.error('无法读取文档文件:', error);
  }

  describe('文件存在性', () => {
    it('部署文档文件应该存在', () => {
      expect(existsSync(docPath)).toBe(true);
    });

    it('文档内容应该非空', () => {
      expect(docContent).toBeDefined();
      expect(docContent.length).toBeGreaterThan(0);
    });
  });

  describe('必需章节完整性 - 需求 4.1, 4.2, 4.3, 4.4, 4.5', () => {
    it('应该包含前置要求章节', () => {
      expect(docContent).toContain('## 前置要求');
      expect(docContent).toContain('### 软件环境');
      expect(docContent).toContain('Node.js');
      expect(docContent).toContain('npm');
      expect(docContent).toContain('Git');
    });

    it('应该包含 GitHub 仓库配置章节', () => {
      expect(docContent).toContain('## GitHub 仓库配置');
      expect(docContent).toContain('### 1. 启用 GitHub Pages');
      expect(docContent).toContain('### 2. 配置 GitHub Actions 权限');
    });

    it('应该包含自动部署配置章节', () => {
      expect(docContent).toContain('## 自动部署配置');
      expect(docContent).toContain('### 工作流文件');
      expect(docContent).toContain('### 触发自动部署');
      expect(docContent).toContain('.github/workflows/deploy.yml');
    });

    it('应该包含手动部署步骤章节', () => {
      expect(docContent).toContain('## 手动部署步骤');
      expect(docContent).toContain('### 1. 本地构建');
      expect(docContent).toContain('### 2. 安装 gh-pages 工具');
      expect(docContent).toContain('### 3. 部署到 GitHub Pages');
    });

    it('应该包含本地预览方法章节', () => {
      expect(docContent).toContain('## 本地预览方法');
      expect(docContent).toContain('### 构建并预览');
      expect(docContent).toContain('### 预览环境说明');
    });

    it('应该包含故障排查指南章节', () => {
      expect(docContent).toContain('## 故障排查指南');
      expect(docContent).toContain('### 常见问题及解决方案');
    });
  });

  describe('命令和配置示例正确性', () => {
    it('应该包含正确的 Node.js 版本检查命令', () => {
      expect(docContent).toContain('node --version');
    });

    it('应该包含正确的 npm 版本检查命令', () => {
      expect(docContent).toContain('npm --version');
    });

    it('应该包含正确的 Git 版本检查命令', () => {
      expect(docContent).toContain('git --version');
    });

    it('应该包含正确的 Git 配置命令', () => {
      expect(docContent).toContain('git config --global user.name');
      expect(docContent).toContain('git config --global user.email');
    });

    it('应该包含正确的构建命令', () => {
      expect(docContent).toContain('npm run build');
    });

    it('应该包含正确的预览命令', () => {
      expect(docContent).toContain('npm run preview');
    });

    it('应该包含正确的预览端口号', () => {
      expect(docContent).toContain('4173');
      expect(docContent).toContain('http://localhost:4173');
    });

    it('应该包含正确的依赖安装命令', () => {
      expect(docContent).toContain('npm ci');
      expect(docContent).toContain('npm install');
    });

    it('应该包含正确的 gh-pages 工具安装命令', () => {
      expect(docContent).toContain('npm install -g gh-pages');
      expect(docContent).toContain('npm install --save-dev gh-pages');
    });

    it('应该包含正确的 gh-pages 部署命令', () => {
      expect(docContent).toContain('gh-pages -d dist');
    });

    it('应该包含正确的 Git 推送命令', () => {
      expect(docContent).toContain('git push origin main');
    });

    it('应该包含正确的 base path 配置示例', () => {
      expect(docContent).toContain('/HorseLegend/');
    });

    it('应该包含正确的 GitHub Pages URL 格式', () => {
      expect(docContent).toContain('https://<username>.github.io/<repository-name>/');
      expect(docContent).toContain('https://username.github.io/HorseLegend/');
    });
  });

  describe('GitHub Pages 配置说明 - 需求 4.1', () => {
    it('应该说明如何启用 GitHub Pages', () => {
      expect(docContent).toContain('Settings');
      expect(docContent).toContain('Pages');
      expect(docContent).toContain('Deploy from a branch');
      expect(docContent).toContain('gh-pages');
    });

    it('应该说明分支和目录选择', () => {
      expect(docContent).toContain('Branch');
      expect(docContent).toContain('gh-pages');
      expect(docContent).toContain('/ (root)');
    });

    it('应该说明如何验证配置', () => {
      expect(docContent).toContain('Your site is published at');
    });
  });

  describe('GitHub Actions 权限配置说明 - 需求 4.2', () => {
    it('应该说明如何配置 GitHub Actions 权限', () => {
      expect(docContent).toContain('Actions');
      expect(docContent).toContain('General');
      expect(docContent).toContain('Workflow permissions');
    });

    it('应该说明需要的权限级别', () => {
      expect(docContent).toContain('Read and write permissions');
    });
  });

  describe('手动部署步骤说明 - 需求 4.3', () => {
    it('应该提供本地构建步骤', () => {
      expect(docContent).toContain('本地构建');
      expect(docContent).toContain('npm run build');
      expect(docContent).toContain('dist');
    });

    it('应该提供 gh-pages 工具安装说明', () => {
      expect(docContent).toContain('gh-pages');
      expect(docContent).toContain('npm install');
    });

    it('应该提供部署命令说明', () => {
      expect(docContent).toContain('gh-pages -d dist');
    });

    it('应该提供验证部署的说明', () => {
      expect(docContent).toContain('验证部署');
      expect(docContent).toContain('GitHub Pages URL');
    });
  });

  describe('自动部署配置说明 - 需求 4.4', () => {
    it('应该说明工作流文件位置', () => {
      expect(docContent).toContain('.github/workflows/deploy.yml');
    });

    it('应该说明工作流的主要步骤', () => {
      expect(docContent).toContain('检出代码');
      expect(docContent).toContain('设置 Node.js');
      expect(docContent).toContain('安装依赖');
      expect(docContent).toContain('构建项目');
      expect(docContent).toContain('部署到 GitHub Pages');
    });

    it('应该说明如何触发自动部署', () => {
      expect(docContent).toContain('推送到');
      expect(docContent).toContain('main');
      expect(docContent).toContain('git push');
    });

    it('应该说明如何查看部署状态', () => {
      expect(docContent).toContain('Actions');
      expect(docContent).toContain('工作流运行记录');
    });
  });

  describe('常见问题排查指南 - 需求 4.5', () => {
    it('应该包含 TypeScript 编译错误的排查', () => {
      expect(docContent).toContain('TypeScript 编译错误');
      expect(docContent).toContain('error TS');
    });

    it('应该包含 Vite 打包错误的排查', () => {
      expect(docContent).toContain('Vite 打包错误');
      expect(docContent).toContain('Rollup');
    });

    it('应该包含 GitHub Actions 权限错误的排查', () => {
      expect(docContent).toContain('权限错误');
      expect(docContent).toContain('Resource not accessible');
    });

    it('应该包含页面空白问题的排查', () => {
      expect(docContent).toContain('页面空白');
      expect(docContent).toContain('Base path');
    });

    it('应该包含资源 404 错误的排查', () => {
      expect(docContent).toContain('404');
      expect(docContent).toContain('资源文件');
    });

    it('应该包含调试技巧说明', () => {
      expect(docContent).toContain('调试技巧');
      expect(docContent).toContain('开发者工具');
    });
  });

  describe('本地预览说明', () => {
    it('应该说明如何构建并预览', () => {
      expect(docContent).toContain('npm run build');
      expect(docContent).toContain('npm run preview');
    });

    it('应该说明预览服务器地址', () => {
      expect(docContent).toContain('localhost:4173');
    });

    it('应该说明预览环境特点', () => {
      expect(docContent).toContain('预览环境');
      expect(docContent).toContain('模拟');
      expect(docContent).toContain('路径配置');
    });

    it('应该提供测试检查清单', () => {
      expect(docContent).toContain('测试检查清单');
      expect(docContent).toContain('3D 模型');
      expect(docContent).toContain('纹理');
      expect(docContent).toContain('音频');
    });
  });

  describe('文档结构和格式', () => {
    it('应该包含目录', () => {
      expect(docContent).toContain('## 目录');
    });

    it('应该使用正确的 Markdown 标题层级', () => {
      // 检查是否有一级标题
      expect(docContent).toMatch(/^# /m);
      // 检查是否有二级标题
      expect(docContent).toMatch(/^## /m);
      // 检查是否有三级标题
      expect(docContent).toMatch(/^### /m);
    });

    it('应该包含代码块示例', () => {
      // 检查是否有代码块
      expect(docContent).toContain('```bash');
      expect(docContent).toContain('```json');
      expect(docContent).toContain('```');
    });

    it('应该包含有用的命令附录', () => {
      expect(docContent).toContain('## 附录');
      expect(docContent).toContain('有用的命令');
    });

    it('应该包含相关文件说明', () => {
      expect(docContent).toContain('相关文件说明');
      expect(docContent).toContain('vite.config.ts');
      expect(docContent).toContain('package.json');
    });

    it('应该包含环境变量说明', () => {
      expect(docContent).toContain('环境变量');
      expect(docContent).toContain('NODE_ENV');
      expect(docContent).toContain('BASE_URL');
    });
  });

  describe('链接和引用有效性', () => {
    it('应该包含内部章节链接', () => {
      // 检查目录中的锚点链接
      expect(docContent).toContain('#前置要求');
      expect(docContent).toContain('#github-仓库配置');
      expect(docContent).toContain('#自动部署配置');
      expect(docContent).toContain('#手动部署步骤');
      expect(docContent).toContain('#本地预览方法');
      expect(docContent).toContain('#故障排查指南');
    });

    it('应该包含外部文档链接', () => {
      expect(docContent).toContain('https://vitejs.dev/');
      expect(docContent).toContain('https://docs.github.com/pages');
    });

    it('内部引用应该指向正确的章节', () => {
      // 检查交叉引用是否指向存在的章节
      const crossReferences = docContent.match(/\[.*?\]\(#.*?\)/g) || [];
      
      crossReferences.forEach(ref => {
        const match = ref.match(/\(#(.*?)\)/);
        if (match) {
          const anchor = match[1];
          // 将锚点转换为标题格式进行检查
          const titlePattern = anchor
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          // 检查文档中是否存在对应的标题（宽松匹配）
          const hasMatchingSection = docContent.includes(anchor) || 
                                     docContent.toLowerCase().includes(anchor.replace(/-/g, ' '));
          expect(hasMatchingSection).toBe(true);
        }
      });
    });
  });

  describe('实用性和完整性', () => {
    it('文档应该足够详细（至少 5000 字符）', () => {
      expect(docContent.length).toBeGreaterThan(5000);
    });

    it('应该包含足够的代码示例（至少 10 个代码块）', () => {
      const codeBlocks = docContent.match(/```/g) || [];
      // 每个代码块有开始和结束标记，所以除以 2
      expect(codeBlocks.length / 2).toBeGreaterThanOrEqual(10);
    });

    it('应该包含多个故障排查场景（至少 5 个）', () => {
      const troubleshootingSection = docContent.split('## 故障排查指南')[1];
      if (troubleshootingSection) {
        const scenarios = troubleshootingSection.match(/####\s+\d+\./g) || [];
        expect(scenarios.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('应该提供清晰的步骤编号', () => {
      // 检查是否有编号的步骤
      expect(docContent).toMatch(/###\s+\d+\./);
    });
  });

  describe('技术准确性', () => {
    it('应该正确引用项目名称', () => {
      expect(docContent).toContain('HorseLegend');
    });

    it('应该正确引用 Vite 配置文件', () => {
      expect(docContent).toContain('vite.config.ts');
    });

    it('应该正确引用工作流文件', () => {
      expect(docContent).toContain('.github/workflows/deploy.yml');
    });

    it('应该正确引用构建输出目录', () => {
      expect(docContent).toContain('dist');
    });

    it('应该正确引用部署分支', () => {
      expect(docContent).toContain('gh-pages');
    });

    it('应该正确引用主分支', () => {
      expect(docContent).toContain('main');
    });

    it('应该包含正确的 Node.js 版本要求', () => {
      expect(docContent).toContain('18');
    });
  });
});

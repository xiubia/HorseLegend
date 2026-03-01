import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

describe('GitHub Actions 工作流配置测试', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/deploy.yml');
  let workflowContent: string;
  let workflowConfig: any;

  // 在所有测试前读取并解析 YAML 文件
  try {
    workflowContent = readFileSync(workflowPath, 'utf-8');
    workflowConfig = parse(workflowContent);
  } catch (error) {
    console.error('无法读取或解析工作流文件:', error);
  }

  describe('文件存在性和语法', () => {
    it('工作流文件应该存在', () => {
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('YAML 文件应该能够正确解析', () => {
      expect(() => parse(workflowContent)).not.toThrow();
      expect(workflowConfig).toBeDefined();
      expect(typeof workflowConfig).toBe('object');
    });

    it('应该包含工作流名称', () => {
      expect(workflowConfig).toHaveProperty('name');
      expect(typeof workflowConfig.name).toBe('string');
      expect(workflowConfig.name.length).toBeGreaterThan(0);
    });
  });

  describe('触发条件配置', () => {
    it('应该配置 push 事件触发', () => {
      expect(workflowConfig).toHaveProperty('on');
      expect(workflowConfig.on).toHaveProperty('push');
    });

    it('应该配置为在 main 分支触发', () => {
      const pushConfig = workflowConfig.on.push;
      expect(pushConfig).toHaveProperty('branches');
      expect(pushConfig.branches).toContain('main');
    });
  });

  describe('权限配置', () => {
    it('应该配置必要的权限', () => {
      expect(workflowConfig).toHaveProperty('permissions');
      expect(typeof workflowConfig.permissions).toBe('object');
    });

    it('应该配置 contents 写入权限', () => {
      expect(workflowConfig.permissions).toHaveProperty('contents');
      expect(workflowConfig.permissions.contents).toBe('write');
    });

    it('应该配置 pages 写入权限', () => {
      expect(workflowConfig.permissions).toHaveProperty('pages');
      expect(workflowConfig.permissions.pages).toBe('write');
    });

    it('应该配置 id-token 写入权限', () => {
      expect(workflowConfig.permissions).toHaveProperty('id-token');
      expect(workflowConfig.permissions['id-token']).toBe('write');
    });
  });

  describe('并发控制配置', () => {
    it('应该配置并发控制', () => {
      expect(workflowConfig).toHaveProperty('concurrency');
      expect(typeof workflowConfig.concurrency).toBe('object');
    });

    it('应该配置并发组为 pages', () => {
      expect(workflowConfig.concurrency).toHaveProperty('group');
      expect(workflowConfig.concurrency.group).toBe('pages');
    });

    it('应该配置不取消正在进行的部署', () => {
      expect(workflowConfig.concurrency).toHaveProperty('cancel-in-progress');
      expect(workflowConfig.concurrency['cancel-in-progress']).toBe(false);
    });
  });

  describe('构建作业配置', () => {
    it('应该包含 build 作业', () => {
      expect(workflowConfig).toHaveProperty('jobs');
      expect(workflowConfig.jobs).toHaveProperty('build');
    });

    it('build 作业应该在 ubuntu-latest 上运行', () => {
      const buildJob = workflowConfig.jobs.build;
      expect(buildJob).toHaveProperty('runs-on');
      expect(buildJob['runs-on']).toBe('ubuntu-latest');
    });

    it('build 作业应该包含必需的步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      expect(buildJob).toHaveProperty('steps');
      expect(Array.isArray(buildJob.steps)).toBe(true);
      expect(buildJob.steps.length).toBeGreaterThan(0);
    });

    it('应该包含代码检出步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      const checkoutStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/checkout')
      );
      expect(checkoutStep).toBeDefined();
    });

    it('应该包含 Node.js 设置步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      const setupNodeStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/setup-node')
      );
      expect(setupNodeStep).toBeDefined();
    });

    it('Node.js 版本应该配置为 18', () => {
      const buildJob = workflowConfig.jobs.build;
      const setupNodeStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/setup-node')
      );
      expect(setupNodeStep.with).toHaveProperty('node-version');
      expect(setupNodeStep.with['node-version']).toBe('18');
    });

    it('应该启用 npm 缓存', () => {
      const buildJob = workflowConfig.jobs.build;
      const setupNodeStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/setup-node')
      );
      expect(setupNodeStep.with).toHaveProperty('cache');
      expect(setupNodeStep.with.cache).toBe('npm');
    });

    it('应该包含依赖安装步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      const installStep = buildJob.steps.find((step: any) => 
        step.run && step.run.includes('npm ci')
      );
      expect(installStep).toBeDefined();
    });

    it('应该包含构建步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      const buildStep = buildJob.steps.find((step: any) => 
        step.run && step.run.includes('npm run build')
      );
      expect(buildStep).toBeDefined();
    });

    it('构建步骤应该设置 NODE_ENV 为 production', () => {
      const buildJob = workflowConfig.jobs.build;
      const buildStep = buildJob.steps.find((step: any) => 
        step.run && step.run.includes('npm run build')
      );
      expect(buildStep.env).toBeDefined();
      expect(buildStep.env.NODE_ENV).toBe('production');
    });

    it('应该包含构建产物上传步骤', () => {
      const buildJob = workflowConfig.jobs.build;
      const uploadStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/upload-artifact')
      );
      expect(uploadStep).toBeDefined();
    });

    it('上传步骤应该配置正确的产物名称和路径', () => {
      const buildJob = workflowConfig.jobs.build;
      const uploadStep = buildJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/upload-artifact')
      );
      expect(uploadStep.with).toHaveProperty('name');
      expect(uploadStep.with.name).toBe('dist');
      expect(uploadStep.with).toHaveProperty('path');
      expect(uploadStep.with.path).toBe('dist/');
    });
  });

  describe('部署作业配置', () => {
    it('应该包含 deploy 作业', () => {
      expect(workflowConfig.jobs).toHaveProperty('deploy');
    });

    it('deploy 作业应该依赖 build 作业', () => {
      const deployJob = workflowConfig.jobs.deploy;
      expect(deployJob).toHaveProperty('needs');
      expect(deployJob.needs).toBe('build');
    });

    it('deploy 作业应该在 ubuntu-latest 上运行', () => {
      const deployJob = workflowConfig.jobs.deploy;
      expect(deployJob).toHaveProperty('runs-on');
      expect(deployJob['runs-on']).toBe('ubuntu-latest');
    });

    it('应该包含构建产物下载步骤', () => {
      const deployJob = workflowConfig.jobs.deploy;
      const downloadStep = deployJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/download-artifact')
      );
      expect(downloadStep).toBeDefined();
    });

    it('下载步骤应该配置正确的产物名称和路径', () => {
      const deployJob = workflowConfig.jobs.deploy;
      const downloadStep = deployJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('actions/download-artifact')
      );
      expect(downloadStep.with).toHaveProperty('name');
      expect(downloadStep.with.name).toBe('dist');
      expect(downloadStep.with).toHaveProperty('path');
      expect(downloadStep.with.path).toBe('dist/');
    });

    it('应该包含 GitHub Pages 部署步骤', () => {
      const deployJob = workflowConfig.jobs.deploy;
      const deployStep = deployJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('peaceiris/actions-gh-pages')
      );
      expect(deployStep).toBeDefined();
    });

    it('部署步骤应该配置正确的参数', () => {
      const deployJob = workflowConfig.jobs.deploy;
      const deployStep = deployJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('peaceiris/actions-gh-pages')
      );
      
      expect(deployStep.with).toHaveProperty('github_token');
      expect(deployStep.with).toHaveProperty('publish_dir');
      expect(deployStep.with.publish_dir).toBe('./dist');
      expect(deployStep.with).toHaveProperty('publish_branch');
      expect(deployStep.with.publish_branch).toBe('gh-pages');
    });

    it('部署步骤应该配置 Git 用户信息', () => {
      const deployJob = workflowConfig.jobs.deploy;
      const deployStep = deployJob.steps.find((step: any) => 
        step.uses && step.uses.startsWith('peaceiris/actions-gh-pages')
      );
      
      expect(deployStep.with).toHaveProperty('user_name');
      expect(deployStep.with).toHaveProperty('user_email');
      expect(deployStep.with.user_name).toBe('github-actions[bot]');
      expect(deployStep.with.user_email).toBe('github-actions[bot]@users.noreply.github.com');
    });
  });

  describe('工作流完整性', () => {
    it('所有步骤都应该有名称', () => {
      const allSteps = [
        ...workflowConfig.jobs.build.steps,
        ...workflowConfig.jobs.deploy.steps
      ];
      
      allSteps.forEach((step: any) => {
        expect(step).toHaveProperty('name');
        expect(typeof step.name).toBe('string');
        expect(step.name.length).toBeGreaterThan(0);
      });
    });

    it('工作流应该包含所有必需的作业', () => {
      const requiredJobs = ['build', 'deploy'];
      requiredJobs.forEach(jobName => {
        expect(workflowConfig.jobs).toHaveProperty(jobName);
      });
    });
  });
});

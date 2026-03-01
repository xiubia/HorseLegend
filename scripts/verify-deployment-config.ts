#!/usr/bin/env node
/**
 * GitHub Pages 部署配置验证脚本
 * 
 * 此脚本验证部署所需的关键配置是否正确设置
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, message: string, details?: string): void {
  results.push({ name, passed: condition, message, details });
}

function runCheck(name: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    check(name, false, '检查失败', error instanceof Error ? error.message : String(error));
  }
}

console.log('🔍 验证 GitHub Pages 部署配置...\n');

// 检查 1: vite.config.ts 存在且配置正确
runCheck('Vite 配置', () => {
  const configPath = join(process.cwd(), 'vite.config.ts');
  check('vite.config.ts 文件', existsSync(configPath), '配置文件存在');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    check(
      'base path 配置',
      content.includes('base:') && content.includes('HorseLegend'),
      'base path 已配置为 /HorseLegend/',
      '确保生产环境使用正确的仓库名'
    );
    
    check(
      'source map 配置',
      content.includes('sourcemap: true'),
      'source map 已启用',
      '便于生产环境调试'
    );
  }
});

// 检查 2: GitHub Actions 工作流配置
runCheck('GitHub Actions 工作流', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/deploy.yml');
  check('deploy.yml 文件', existsSync(workflowPath), '工作流配置文件存在');
  
  if (existsSync(workflowPath)) {
    const content = readFileSync(workflowPath, 'utf-8');
    
    check(
      '触发条件',
      content.includes('push:') && content.includes('branches:') && content.includes('- main'),
      '配置为 main 分支推送时触发'
    );
    
    check(
      '权限配置',
      content.includes('permissions:') && content.includes('contents: write'),
      '已配置必要的写入权限'
    );
    
    check(
      '构建步骤',
      content.includes('npm ci') && content.includes('npm run build'),
      '包含依赖安装和构建步骤'
    );
    
    check(
      '部署步骤',
      content.includes('peaceiris/actions-gh-pages'),
      '使用 gh-pages 部署 action'
    );
  }
});

// 检查 3: package.json 脚本
runCheck('NPM 脚本', () => {
  const packagePath = join(process.cwd(), 'package.json');
  check('package.json 文件', existsSync(packagePath), 'package.json 存在');
  
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    
    check(
      'build 脚本',
      pkg.scripts?.build && pkg.scripts.build.includes('vite build'),
      'build 脚本已配置'
    );
    
    check(
      'preview 脚本',
      pkg.scripts?.preview && pkg.scripts.preview.includes('vite preview'),
      'preview 脚本已配置',
      '用于本地预览生产构建'
    );
  }
});

// 检查 4: Git 配置
runCheck('Git 配置', () => {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    check(
      'Git 远程仓库',
      remoteUrl.includes('github.com'),
      '已配置 GitHub 远程仓库',
      remoteUrl
    );
    
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    check(
      '当前分支',
      currentBranch.length > 0,
      `当前在 ${currentBranch} 分支`
    );
  } catch (error) {
    check('Git 仓库', false, '不是 Git 仓库或 Git 未安装');
  }
});

// 检查 5: 构建产物目录
runCheck('构建产物', () => {
  const distPath = join(process.cwd(), 'dist');
  const distExists = existsSync(distPath);
  
  check(
    'dist 目录',
    distExists,
    distExists ? 'dist 目录存在（已构建）' : 'dist 目录不存在（尚未构建）',
    distExists ? '运行 npm run build 生成' : '首次部署前需要运行 npm run build'
  );
  
  if (distExists) {
    const indexPath = join(distPath, 'index.html');
    check(
      'index.html',
      existsSync(indexPath),
      'index.html 存在于 dist 目录'
    );
    
    const assetsPath = join(distPath, 'assets');
    check(
      'assets 目录',
      existsSync(assetsPath),
      'assets 目录存在于 dist 目录'
    );
  }
});

// 检查 6: 部署文档
runCheck('部署文档', () => {
  const docPath = join(process.cwd(), 'docs/deployment.md');
  check(
    'deployment.md',
    existsSync(docPath),
    '部署文档存在',
    '位于 docs/deployment.md'
  );
  
  const verificationPath = join(process.cwd(), 'docs/github-actions-verification.md');
  check(
    'github-actions-verification.md',
    existsSync(verificationPath),
    'GitHub Actions 验证指南存在',
    '位于 docs/github-actions-verification.md'
  );
});

// 输出结果
console.log('📋 检查结果:\n');

let passedCount = 0;
let failedCount = 0;

for (const result of results) {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  
  if (result.passed) {
    passedCount++;
  } else {
    failedCount++;
  }
}

console.log(`\n📊 总计: ${passedCount} 通过, ${failedCount} 失败\n`);

if (failedCount === 0) {
  console.log('🎉 所有配置检查通过！');
  console.log('\n📖 下一步：');
  console.log('   1. 运行 npm run build 确保构建成功');
  console.log('   2. 运行 npm run preview 验证本地预览');
  console.log('   3. 参考 docs/github-actions-verification.md 进行 GitHub Actions 验证');
  process.exit(0);
} else {
  console.log('⚠️  部分配置检查失败，请修复后重试。');
  console.log('\n📖 参考文档：');
  console.log('   - docs/deployment.md - 部署配置指南');
  console.log('   - docs/github-actions-verification.md - GitHub Actions 验证指南');
  process.exit(1);
}

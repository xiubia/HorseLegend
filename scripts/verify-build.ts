#!/usr/bin/env node

/**
 * 构建后验证脚本
 * 
 * 功能：
 * 1. 检查 dist 目录结构
 * 2. 验证必需文件存在（index.html, assets/）
 * 3. 验证资源目录结构与源目录一致
 * 4. 输出构建产物大小统计
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileInfo {
  path: string;
  size: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalSize: number;
    fileCount: number;
    files: FileInfo[];
  };
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 递归获取目录中的所有文件
 */
function getAllFiles(dir: string, baseDir: string = dir): FileInfo[] {
  const files: FileInfo[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const stats = fs.statSync(fullPath);
      files.push({
        path: path.relative(baseDir, fullPath),
        size: stats.size
      });
    }
  }
  
  return files;
}

/**
 * 获取目录结构（仅目录名）
 */
function getDirectoryStructure(dir: string): string[] {
  const dirs: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return dirs;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs.push(entry.name);
      const fullPath = path.join(dir, entry.name);
      const subDirs = getDirectoryStructure(fullPath);
      dirs.push(...subDirs.map(sub => path.join(entry.name, sub)));
    }
  }
  
  return dirs;
}

/**
 * 验证构建产物
 */
function verifyBuild(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    stats: {
      totalSize: 0,
      fileCount: 0,
      files: []
    }
  };

  const distDir = path.resolve(process.cwd(), 'dist');
  const assetsSourceDir = path.resolve(process.cwd(), 'assets');

  // 1. 检查 dist 目录是否存在
  if (!fs.existsSync(distDir)) {
    result.errors.push('❌ dist 目录不存在，请先执行构建命令：npm run build');
    result.success = false;
    return result;
  }

  // 2. 检查必需文件：index.html
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    result.errors.push('❌ 缺少必需文件：dist/index.html');
    result.success = false;
  }

  // 3. 检查必需目录：assets/
  const assetsDistDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDistDir)) {
    result.errors.push('❌ 缺少必需目录：dist/assets/');
    result.success = false;
  }

  // 4. 验证资源目录结构与源目录一致
  if (fs.existsSync(assetsSourceDir) && fs.existsSync(assetsDistDir)) {
    const sourceStructure = getDirectoryStructure(assetsSourceDir);
    const distStructure = getDirectoryStructure(assetsDistDir);
    
    // 检查源目录中的子目录是否都存在于 dist/assets 中
    for (const sourceDir of sourceStructure) {
      if (!distStructure.includes(sourceDir)) {
        result.warnings.push(`⚠️  源资源目录 assets/${sourceDir} 在构建产物中不存在`);
      }
    }
  }

  // 5. 收集所有文件信息和大小统计
  const allFiles = getAllFiles(distDir);
  result.stats.files = allFiles;
  result.stats.fileCount = allFiles.length;
  result.stats.totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);

  return result;
}

/**
 * 打印验证结果
 */
function printResults(result: ValidationResult): void {
  console.log('\n=== 构建产物验证报告 ===\n');

  // 打印错误
  if (result.errors.length > 0) {
    console.log('错误：');
    result.errors.forEach(error => console.log(`  ${error}`));
    console.log('');
  }

  // 打印警告
  if (result.warnings.length > 0) {
    console.log('警告：');
    result.warnings.forEach(warning => console.log(`  ${warning}`));
    console.log('');
  }

  // 打印成功信息
  if (result.success && result.errors.length === 0) {
    console.log('✅ 所有必需文件和目录验证通过\n');
  }

  // 打印统计信息
  console.log('=== 构建产物统计 ===\n');
  console.log(`总文件数：${result.stats.fileCount}`);
  console.log(`总大小：${formatSize(result.stats.totalSize)}\n`);

  // 按文件类型分组统计
  const filesByType: Record<string, FileInfo[]> = {};
  result.stats.files.forEach(file => {
    const ext = path.extname(file.path) || '(无扩展名)';
    if (!filesByType[ext]) {
      filesByType[ext] = [];
    }
    filesByType[ext].push(file);
  });

  console.log('按文件类型统计：');
  Object.keys(filesByType).sort().forEach(ext => {
    const files = filesByType[ext];
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    console.log(`  ${ext}: ${files.length} 个文件, ${formatSize(totalSize)}`);
  });

  // 打印最大的文件
  console.log('\n最大的 10 个文件：');
  const sortedFiles = [...result.stats.files].sort((a, b) => b.size - a.size);
  sortedFiles.slice(0, 10).forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.path} - ${formatSize(file.size)}`);
  });

  console.log('\n=== 验证完成 ===\n');
}

// 执行验证
const result = verifyBuild();
printResults(result);

// 根据验证结果设置退出码
process.exit(result.success ? 0 : 1);

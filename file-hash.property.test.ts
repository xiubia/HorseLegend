import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Feature: github-pages-deployment, Property 2: 文件哈希命名规则
 * **Validates: Requirements 6.4**
 * 
 * 属性：对于任意构建产物（JS、CSS、资源文件），其文件名都应该包含基于内容的哈希值，
 * 格式为 [name]-[hash].[ext] 或 [name].[hash].[ext]。
 */

describe('文件哈希命名属性测试', () => {
  const distDir = join(process.cwd(), 'dist');
  const assetsDir = join(distDir, 'assets');

  beforeAll(() => {
    // 确保在生产模式下执行构建
    console.log('执行生产构建...');
    try {
      execSync('npm run build', {
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'inherit'
      });
      console.log('构建完成');
    } catch (error) {
      console.error('构建失败:', error);
      throw error;
    }
  });

  describe('属性 2：文件哈希命名规则', () => {
    it('dist/assets 目录应该存在', () => {
      expect(existsSync(distDir)).toBe(true);
      expect(existsSync(assetsDir)).toBe(true);
    });

    it('属性测试：所有 JS 文件应该包含内容哈希', () => {
      // 收集所有 JS 文件
      const jsFiles: string[] = [];
      
      function collectJsFiles(dir: string) {
        if (!existsSync(dir)) return;
        
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectJsFiles(fullPath);
          } else if (item.endsWith('.js')) {
            jsFiles.push(item);
          }
        });
      }
      
      collectJsFiles(assetsDir);

      // 验证至少有一些 JS 文件
      expect(jsFiles.length).toBeGreaterThan(0);

      // 使用 fast-check 验证文件名格式
      fc.assert(
        fc.property(
          fc.constantFrom(...jsFiles),
          (fileName) => {
            // 文件名应该匹配模式：name-hash.js
            // Vite 使用 8 个字符的哈希值（字母、数字、下划线、连字符）
            const hashPattern = /^.+-[A-Za-z0-9_-]{8}\.js$/;
            
            const matches = hashPattern.test(fileName);
            
            if (!matches) {
              console.log(`JS 文件名不匹配哈希模式: ${fileName}`);
            }
            
            return matches;
          }
        ),
        {
          numRuns: 100,
          verbose: true
        }
      );
    });

    it('属性测试：所有 CSS 文件应该包含内容哈希', () => {
      // 收集所有 CSS 文件
      const cssFiles: string[] = [];
      
      function collectCssFiles(dir: string) {
        if (!existsSync(dir)) return;
        
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectCssFiles(fullPath);
          } else if (item.endsWith('.css')) {
            cssFiles.push(item);
          }
        });
      }
      
      collectCssFiles(assetsDir);

      // 如果没有 CSS 文件，跳过测试
      if (cssFiles.length === 0) {
        console.log('警告：没有找到 CSS 文件');
        return;
      }

      // 使用 fast-check 验证文件名格式
      fc.assert(
        fc.property(
          fc.constantFrom(...cssFiles),
          (fileName) => {
            // 文件名应该匹配模式：name-hash.css
            const hashPattern = /^.+-[A-Za-z0-9_-]{8}\.css$/;
            
            const matches = hashPattern.test(fileName);
            
            if (!matches) {
              console.log(`CSS 文件名不匹配哈希模式: ${fileName}`);
            }
            
            return matches;
          }
        ),
        {
          numRuns: 100,
          verbose: true
        }
      );
    });

    it('单元测试：验证哈希值基于文件内容（通过检查不同文件有不同哈希）', () => {
      // 这个测试验证不同的文件有不同的哈希值
      // 这证明哈希确实基于文件内容
      
      const fileHashes = new Map<string, string>();
      
      function collectFileHashes(dir: string) {
        if (!existsSync(dir)) return;
        
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectFileHashes(fullPath);
          } else if (item.endsWith('.js') || item.endsWith('.css')) {
            // 提取哈希值
            const match = item.match(/^(.+)-([A-Za-z0-9_-]{8})\.(js|css)$/);
            if (match) {
              const baseName = match[1];
              const hash = match[2];
              fileHashes.set(baseName, hash);
            }
          }
        });
      }
      
      collectFileHashes(assetsDir);
      
      // 验证至少有两个文件
      expect(fileHashes.size).toBeGreaterThanOrEqual(2);
      
      // 验证不同文件有不同的哈希值
      // 如果所有文件都有相同的哈希，那说明哈希不是基于内容的
      const hashes = Array.from(fileHashes.values());
      const uniqueHashes = new Set(hashes);
      
      // 至少应该有两个不同的哈希值（因为 index 和 three 是不同的文件）
      expect(uniqueHashes.size).toBeGreaterThanOrEqual(2);
      
      console.log('文件哈希映射:', Array.from(fileHashes.entries()));
    });

    it('属性测试：相同内容的文件应该生成相同的哈希', () => {
      // 这个测试验证哈希的确定性
      // 多次构建相同的源代码应该生成相同的哈希值
      
      // 收集第一次构建的文件
      const firstBuildFiles = new Map<string, string>();
      
      function collectFilesWithHash(dir: string, targetMap: Map<string, string>) {
        if (!existsSync(dir)) return;
        
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectFilesWithHash(fullPath, targetMap);
          } else if (item.endsWith('.js') || item.endsWith('.css')) {
            // 提取基础名和哈希
            const match = item.match(/^(.+)-([A-Za-z0-9_-]{8})\.(js|css)$/);
            if (match) {
              const baseName = match[1];
              const hash = match[2];
              const extension = match[3];
              const key = `${baseName}.${extension}`;
              targetMap.set(key, hash);
            }
          }
        });
      }
      
      collectFilesWithHash(assetsDir, firstBuildFiles);
      
      // 验证至少有一些文件
      expect(firstBuildFiles.size).toBeGreaterThan(0);
      
      // 重新构建（不修改任何源文件）
      console.log('重新构建以验证哈希确定性...');
      execSync('npm run build', {
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'inherit'
      });
      
      // 收集第二次构建的文件
      const secondBuildFiles = new Map<string, string>();
      collectFilesWithHash(assetsDir, secondBuildFiles);
      
      // 验证所有文件的哈希值相同
      fc.assert(
        fc.property(
          fc.constantFrom(...Array.from(firstBuildFiles.keys())),
          (fileKey) => {
            const firstHash = firstBuildFiles.get(fileKey);
            const secondHash = secondBuildFiles.get(fileKey);
            
            if (!secondHash) {
              console.log(`第二次构建中未找到文件: ${fileKey}`);
              return false;
            }
            
            const hashesMatch = firstHash === secondHash;
            
            if (!hashesMatch) {
              console.log(`哈希值不匹配: ${fileKey}`);
              console.log(`  第一次: ${firstHash}`);
              console.log(`  第二次: ${secondHash}`);
            }
            
            return hashesMatch;
          }
        ),
        {
          numRuns: 100,
          verbose: true
        }
      );
    });
  });
});

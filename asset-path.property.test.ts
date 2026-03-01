import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * Feature: github-pages-deployment, Property 1: 资源路径正确性
 * **Validates: Requirements 1.3, 3.1**
 * 
 * 属性：对于任意静态资源文件（模型、纹理、音频），构建后的引用路径都应该包含正确的 base path 前缀，
 * 且资源文件应该存在于 dist 目录的对应位置。
 */

describe('资源路径属性测试', () => {
  const distDir = join(process.cwd(), 'dist');
  const assetsDir = join(process.cwd(), 'assets');
  const basePath = '/HorseLegend/';

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

  describe('属性 1：资源路径正确性', () => {
    it('构建产物中的所有资源文件应该存在于 dist 目录', () => {
      // 验证 dist 目录存在
      expect(existsSync(distDir)).toBe(true);

      // 验证 dist/assets 目录存在
      const distAssetsDir = join(distDir, 'assets');
      expect(existsSync(distAssetsDir)).toBe(true);
    });

    it('index.html 应该包含正确的 base path 引用', () => {
      const indexPath = join(distDir, 'index.html');
      expect(existsSync(indexPath)).toBe(true);

      const indexContent = readFileSync(indexPath, 'utf-8');
      
      // 验证 HTML 中的资源引用包含 base path
      // Vite 会将资源路径转换为 /HorseLegend/assets/...
      const scriptMatches = indexContent.match(/src="([^"]+)"/g);
      const linkMatches = indexContent.match(/href="([^"]+)"/g);
      
      const allMatches = [
        ...(scriptMatches || []),
        ...(linkMatches || [])
      ];

      // 至少应该有一些资源引用
      expect(allMatches.length).toBeGreaterThan(0);

      // 检查所有资源引用是否包含 base path
      allMatches.forEach(match => {
        const urlMatch = match.match(/(?:src|href)="([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          // 跳过外部链接和数据 URL
          if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('#')) {
            expect(url).toMatch(new RegExp(`^${basePath}`));
          }
        }
      });
    });

    it('属性测试：随机资源文件路径应该在构建后正确处理', () => {
      // 收集实际存在的资源文件
      const actualAssets: string[] = [];
      
      function collectAssets(dir: string) {
        if (!existsSync(dir)) return;
        
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectAssets(fullPath);
          } else {
            // 获取相对于 assets 目录的路径
            const relativePath = relative(assetsDir, fullPath);
            actualAssets.push(relativePath);
          }
        });
      }
      
      collectAssets(assetsDir);

      // 如果没有资源文件，跳过测试
      if (actualAssets.length === 0) {
        console.log('警告：assets 目录中没有找到资源文件');
        return;
      }

      // 使用 fast-check 进行属性测试
      fc.assert(
        fc.property(
          fc.constantFrom(...actualAssets),
          (assetPath) => {
            // 将路径标准化（使用正斜杠）
            const normalizedPath = assetPath.split(sep).join('/');
            
            // 在 dist/assets 目录中查找对应的文件
            // Vite 会为文件添加哈希，所以我们需要查找匹配的文件
            const distAssetsDir = join(distDir, 'assets');
            
            // 提取文件名（不含扩展名）和扩展名
            const lastSlashIndex = normalizedPath.lastIndexOf('/');
            const fileName = lastSlashIndex >= 0 
              ? normalizedPath.substring(lastSlashIndex + 1) 
              : normalizedPath;
            
            const lastDotIndex = fileName.lastIndexOf('.');
            const baseName = lastDotIndex >= 0 
              ? fileName.substring(0, lastDotIndex) 
              : fileName;
            const extension = lastDotIndex >= 0 
              ? fileName.substring(lastDotIndex) 
              : '';

            // 在 dist/assets 中查找匹配的文件（可能包含哈希）
            function findMatchingFile(dir: string, pattern: string, ext: string): boolean {
              if (!existsSync(dir)) return false;
              
              const items = readdirSync(dir);
              for (const item of items) {
                const fullPath = join(dir, item);
                const stat = statSync(fullPath);
                
                if (stat.isDirectory()) {
                  if (findMatchingFile(fullPath, pattern, ext)) {
                    return true;
                  }
                } else {
                  // 检查文件名是否匹配模式：baseName-hash.ext
                  const regex = new RegExp(`^${pattern}-[a-f0-9]+${ext.replace('.', '\\.')}$`);
                  if (regex.test(item)) {
                    return true;
                  }
                }
              }
              
              return false;
            }

            const fileExists = findMatchingFile(distAssetsDir, baseName, extension);
            
            // 如果文件不存在，提供详细的错误信息
            if (!fileExists) {
              console.log(`未找到资源文件: ${assetPath}`);
              console.log(`查找模式: ${baseName}-[hash]${extension}`);
              console.log(`在目录: ${distAssetsDir}`);
            }
            
            return fileExists;
          }
        ),
        {
          numRuns: 100, // 运行 100 次迭代
          verbose: true
        }
      );
    });

    it('属性测试：构建产物中的资源文件名应该包含哈希值', () => {
      const distAssetsDir = join(distDir, 'assets');
      
      if (!existsSync(distAssetsDir)) {
        throw new Error('dist/assets 目录不存在');
      }

      // 收集所有构建产物文件
      const builtFiles: string[] = [];
      
      function collectBuiltFiles(dir: string) {
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            collectBuiltFiles(fullPath);
          } else {
            builtFiles.push(item);
          }
        });
      }
      
      collectBuiltFiles(distAssetsDir);

      // 验证至少有一些文件
      expect(builtFiles.length).toBeGreaterThan(0);

      // 使用 fast-check 验证文件名格式
      fc.assert(
        fc.property(
          fc.constantFrom(...builtFiles),
          (fileName) => {
            // 文件名应该匹配模式：name-hash.ext 或 name-hash.ext.map
            // Vite 使用 8 个字符的 base64 风格哈希（包含字母、数字、下划线、连字符）
            const hashPattern = /^.+-[A-Za-z0-9_-]{8}\.(js|css|png|jpg|jpeg|gif|svg|glb|gltf|mp3|wav|ogg)(\.map)?$/;
            
            const matches = hashPattern.test(fileName);
            
            if (!matches) {
              console.log(`文件名不匹配哈希模式: ${fileName}`);
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

    it('属性测试：所有 JS 和 CSS 文件应该在 assets 目录下', () => {
      const distAssetsDir = join(distDir, 'assets');
      
      // 收集 dist 目录下的所有 JS 和 CSS 文件
      const jsAndCssFiles: string[] = [];
      
      function collectJsAndCss(dir: string, relativePath: string = '') {
        const items = readdirSync(dir);
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          const currentRelativePath = relativePath ? `${relativePath}/${item}` : item;
          
          if (stat.isDirectory()) {
            collectJsAndCss(fullPath, currentRelativePath);
          } else if (/\.(js|css)$/.test(item)) {
            jsAndCssFiles.push(currentRelativePath);
          }
        });
      }
      
      collectJsAndCss(distDir);

      // 验证所有 JS 和 CSS 文件都在 assets 目录下
      fc.assert(
        fc.property(
          fc.constantFrom(...jsAndCssFiles),
          (filePath) => {
            const isInAssets = filePath.startsWith('assets/');
            
            if (!isInAssets) {
              console.log(`文件不在 assets 目录下: ${filePath}`);
            }
            
            return isInAssets;
          }
        ),
        {
          numRuns: Math.min(100, jsAndCssFiles.length),
          verbose: true
        }
      );
    });
  });
});

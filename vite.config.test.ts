import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineConfig } from 'vite';

describe('Vite 配置测试', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // 恢复原始环境变量
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    // 重置所有模块
    vi.resetModules();
  });

  describe('配置对象结构', () => {
    it('应该导出有效的 Vite 配置对象', async () => {
      const config = await import('./vite.config');
      expect(config.default).toBeDefined();
      expect(typeof config.default).toBe('object');
    });

    it('应该包含 base 配置', async () => {
      const config = await import('./vite.config');
      expect(config.default).toHaveProperty('base');
    });

    it('应该包含 build 配置', async () => {
      const config = await import('./vite.config');
      expect(config.default).toHaveProperty('build');
      expect(config.default.build).toBeDefined();
    });
  });

  describe('base path 配置', () => {
    it('在生产环境下应该使用 /HorseLegend/ 作为 base path', async () => {
      process.env.NODE_ENV = 'production';
      
      // 重置模块以重新加载配置
      vi.resetModules();
      
      // 动态导入配置
      const configModule = await import('./vite.config');
      const config = configModule.default;
      
      expect(config.base).toBe('/HorseLegend/');
    });

    it('在开发环境下应该使用 / 作为 base path', async () => {
      process.env.NODE_ENV = 'development';
      
      // 重置模块以重新加载配置
      vi.resetModules();
      
      // 动态导入配置
      const configModule = await import('./vite.config');
      const config = configModule.default;
      
      expect(config.base).toBe('/');
    });

    it('在未设置 NODE_ENV 时应该使用 / 作为 base path', async () => {
      delete process.env.NODE_ENV;
      
      // 重置模块以重新加载配置
      vi.resetModules();
      
      // 动态导入配置
      const configModule = await import('./vite.config');
      const config = configModule.default;
      
      expect(config.base).toBe('/');
    });
  });

  describe('构建选项配置', () => {
    it('应该配置输出目录为 dist', async () => {
      const config = await import('./vite.config');
      expect(config.default.build.outDir).toBe('dist');
    });

    it('应该启用 source map', async () => {
      const config = await import('./vite.config');
      expect(config.default.build.sourcemap).toBe(true);
    });

    it('应该使用 terser 进行代码压缩', async () => {
      const config = await import('./vite.config');
      expect(config.default.build.minify).toBe('terser');
    });

    it('应该配置 rollup 选项', async () => {
      const config = await import('./vite.config');
      expect(config.default.build.rollupOptions).toBeDefined();
      expect(config.default.build.rollupOptions.output).toBeDefined();
    });
  });

  describe('代码分割配置', () => {
    it('应该将 Three.js 单独打包', async () => {
      const config = await import('./vite.config');
      const manualChunks = config.default.build.rollupOptions.output.manualChunks;
      
      expect(manualChunks).toBeDefined();
      expect(manualChunks).toHaveProperty('three');
      expect(manualChunks.three).toEqual(['three']);
    });
  });

  describe('文件命名规则', () => {
    it('应该为资源文件配置哈希命名规则', async () => {
      const config = await import('./vite.config');
      const assetFileNames = config.default.build.rollupOptions.output.assetFileNames;
      
      expect(assetFileNames).toBe('assets/[name]-[hash][extname]');
    });

    it('应该为 chunk 文件配置哈希命名规则', async () => {
      const config = await import('./vite.config');
      const chunkFileNames = config.default.build.rollupOptions.output.chunkFileNames;
      
      expect(chunkFileNames).toBe('assets/[name]-[hash].js');
    });

    it('应该为入口文件配置哈希命名规则', async () => {
      const config = await import('./vite.config');
      const entryFileNames = config.default.build.rollupOptions.output.entryFileNames;
      
      expect(entryFileNames).toBe('assets/[name]-[hash].js');
    });
  });
});

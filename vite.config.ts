import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 部署路径配置
  // 生产环境使用仓库名作为子路径，开发环境使用根路径
  base: process.env.NODE_ENV === 'production' ? '/HorseLegend/' : '/',

  build: {
    // 构建输出目录
    outDir: 'dist',
    
    // 生成 source map 以便生产环境调试
    sourcemap: true,
    
    // 使用 Terser 进行代码压缩和混淆
    minify: 'terser',
    
    // Rollup 打包配置
    rollupOptions: {
      output: {
        // 代码分割策略：将 Three.js 单独打包
        manualChunks: {
          'three': ['three']
        },
        
        // 资源文件命名规则（包含内容哈希以支持长期缓存）
        assetFileNames: 'assets/[name]-[hash][extname]',
        
        // chunk 文件命名规则（包含内容哈希）
        chunkFileNames: 'assets/[name]-[hash].js',
        
        // 入口文件命名规则（包含内容哈希）
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
});

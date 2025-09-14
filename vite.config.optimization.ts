import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';

/**
 * 优化的Vite配置
 * 包含代码分割和性能优化设置
 */
export default defineConfig(async () => ({
  define: {
    __PLATFORM__: JSON.stringify(process.env.PLATFORM),
    __PLATFORM_TAURI__: JSON.stringify('tauri'),
    __PLATFORM_WEB__: JSON.stringify('web'),
  },
  plugins: [react(), TanStackRouterVite()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    // 启用代码分割优化
    rollupOptions: {
      output: {
        // 手动分割代码块
        manualChunks: {
          // React相关
          'react-vendor': ['react', 'react-dom'],
          // 路由相关
          'router-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
          // UI组件库
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-checkbox', '@radix-ui/react-label'],
          // Monaco Editor单独分块
          'monaco-editor': ['monaco-editor'],
          // Tauri API
          'tauri-vendor': ['@tauri-apps/api'],
        },
      },
    },
    // 增加chunk大小限制警告阈值
    chunkSizeWarningLimit: 1000,
    // 启用源码映射（开发时）
    sourcemap: process.env.NODE_ENV === 'development',
  },
  // 依赖优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-router',
      '@tanstack/react-query',
    ],
    exclude: [
      // Monaco Editor延迟加载，不需要预构建
      'monaco-editor',
    ],
  },
}));

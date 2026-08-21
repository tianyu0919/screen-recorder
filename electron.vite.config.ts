import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron/main',
      lib: { entry: resolve(__dirname, 'electron/main/index.ts') },
      rollupOptions: {
        // uiohook-napi 为原生模块（N-API 预编译），运行时加载，不打包
        external: ['uiohook-napi']
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      lib: { entry: resolve(__dirname, 'electron/preload/index.ts') }
    }
  },
  renderer: {
    root: 'src',
    // 导出 worker 首跑才 import mediabunny/mp4-muxer；不预打包会导致 dev 期发现新依赖 →
    // 重新优化 → 整页刷新（表现为"第一次导出闪退回首页，第二次正常"）
    optimizeDeps: {
      include: ['mediabunny', 'mp4-muxer']
    },
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'src/index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    plugins: [react()]
  }
})

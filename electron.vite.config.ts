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

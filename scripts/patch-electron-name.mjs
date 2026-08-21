/**
 * 修复开发期 macOS Dock 悬停名/菜单名显示 "Electron" 的问题。
 *
 * 原因：dev 跑的是 node_modules/electron 里的 Electron.app 官方二进制，
 * Dock 提示名直接读该 bundle 的 CFBundleName / CFBundleDisplayName，
 * app.setName() 管不到这一层。
 *
 * 本脚本在 postinstall 时把这两个键改为应用名（改名时与 electron/main/index.ts
 * 的 APP_NAME、index.html <title>、App.tsx、electron-builder.yml 四处同步）。
 * 仅影响本地开发；打包产物由 electron-builder 用 productName 生成 Info.plist，与此无关。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const APP_NAME = 'Lenza'

if (process.platform === 'darwin') {
  const plist = join(
    process.cwd(),
    'node_modules/electron/dist/Electron.app/Contents/Info.plist'
  )
  if (existsSync(plist)) {
    for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
      execFileSync('plutil', ['-replace', key, '-string', APP_NAME, plist])
    }
    console.log(`[patch-electron-name] Electron.app 开发期显示名已改为 ${APP_NAME}`)
  }
}

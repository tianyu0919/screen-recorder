import { app, BrowserWindow, nativeImage, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from '../ipc'
import { registerDisplayMediaHandler } from '../capture/sources'
import { registerMediaProtocol } from '../store/sessionReader'

/**
 * 应用名（改名时四处同步：index.html <title>、App.tsx 标题、electron-builder.yml
 * productName/shortcutName、这里）。开发期菜单栏/Dock 继承的是 Electron 二进制的
 * 名字与图标，需显式覆盖；打包后由 electron-builder 的 productName + build/icon.* 接管。
 */
const APP_NAME = 'Lenza'
app.setName(APP_NAME)

const iconPath = join(app.getAppPath(), 'build/icon.png')
const appIcon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

// media:// 流式播放录制视频（kr-02 预览）；须在 app ready 前注册特权
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
])

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    // 下限按编辑器布局估算：检查器 280 + 舞台最小宽度；时间轴 168 + 双工具栏 + 舞台最小高度
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0a0a0c',
    // Windows/Linux 任务栏与窗口图标（macOS 走 Dock，由下方 app.dock.setIcon 覆盖）
    ...(appIcon ? { icon: appIcon } : {}),
    // macOS 红绿灯内嵌（拖拽区由 Renderer 的 .app-drag 提供）；Windows 保留原生标题栏
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // ESM preload（.mjs）要求关闭 sandbox；sandboxed preload 只支持 CJS
      sandbox: false,
      // 屏幕采集需要
      webSecurity: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  // 仅开发期覆盖 Dock 图标；打包后 .app 自带 icns，无需也不应覆盖
  if (process.platform === 'darwin' && appIcon && !app.isPackaged) {
    app.dock?.setIcon(appIcon)
  }
  registerDisplayMediaHandler()
  registerMediaProtocol()
  registerIpc(() => win)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

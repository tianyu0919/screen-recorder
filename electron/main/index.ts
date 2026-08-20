import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'node:path'
import { registerIpc } from '../ipc'
import { registerDisplayMediaHandler } from '../capture/sources'
import { registerMediaProtocol } from '../store/sessionReader'

// media:// 流式播放录制视频（kr-02 预览）；须在 app ready 前注册特权
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, supportFetchAPI: true } }
])

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
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

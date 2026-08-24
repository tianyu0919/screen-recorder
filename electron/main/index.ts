import { app, BrowserWindow, Menu, nativeImage, nativeTheme, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from '../ipc'
import { IPC } from '../../shared/ipc'
import { registerDisplayMediaHandler } from '../capture/sources'
import { registerMediaProtocol } from '../store/sessionReader'
import { appSettings } from '../store/appSettings'
import { sessionCatalog } from '../store/sessionCatalog'
import {
  backgroundWindow,
  configureAboutPanel,
  disposeTray,
  showWindow
} from '../windowLifecycle'
import { updateService } from '../updater'
import { displaySelectionOutline } from '../displaySelectionOutline'
import {
  disableApplicationMenuReload,
  installReloadShortcutGuard
} from '../windowLifecycle/reloadGuard'
import packageMetadata from '../../package.json'

/**
 * 应用名（改名时四处同步：index.html <title>、App.tsx 标题、electron-builder.yml
 * productName/shortcutName、这里）。开发期菜单栏/Dock 继承的是 Electron 二进制的
 * 名字与图标，需显式覆盖；打包后由 electron-builder 的 productName + build/icon.* 接管。
 */
const APP_NAME = 'Lenza'
app.setName(APP_NAME)

function loadAppIcon() {
  const iconPath = app.isPackaged && process.platform === 'win32'
    ? join(process.resourcesPath, 'tray-icon.ico')
    : join(app.getAppPath(), 'build/icon.png')
  if (!existsSync(iconPath)) return undefined
  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty() ? undefined : icon
}

const appIcon = loadAppIcon()

let win: BrowserWindow | null = null
let quitting = false

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 956,
    // 下限按编辑器布局估算：检查器 280 + 舞台卡片最小宽度；时间轴 168 + 工具栏 + 舞台可用高度
    // （小于此尺寸舞台会被压扁，以 1280x956 为可用下限）
    minWidth: 1280,
    minHeight: 956,
    // 启动背景跟 OS 深浅色（Renderer 主题就绪前的闪白/闪黑抑制；实际主题以 themeStore 为准）
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0c' : '#e9e9ed',
    // Windows/Linux 任务栏与窗口图标（macOS 走 Dock，由下方 app.dock.setIcon 覆盖）
    ...(appIcon ? { icon: appIcon } : {}),
    // macOS 红绿灯内嵌；Windows 隐藏原生标题栏，控制按钮由 Renderer 自绘（.app-drag 提供拖拽）
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
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
  installReloadShortcutGuard(win)

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    void displaySelectionOutline.hide()
    win = null
  })

  win.on('hide', () => void displaySelectionOutline.hide())

  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    // macOS 红色关闭按钮遵循原生语义：仅隐藏窗口，⌘Q / 菜单栏退出才结束进程。
    if (process.platform === 'darwin') {
      backgroundWindow(win!, appIcon)
      return
    }
    const behavior = appSettings.get().closeBehavior
    if (behavior === 'background') backgroundWindow(win!, appIcon)
    else if (behavior === 'quit') app.quit()
    else win?.webContents.send(IPC.WindowCloseRequested)
  })

  // 最大化状态推送 Renderer（自绘窗口按钮切换 最大化/还原 图标）
  win.on('maximize', () => win?.webContents.send(IPC.WindowMaximizeChanged, true))
  win.on('unmaximize', () => win?.webContents.send(IPC.WindowMaximizeChanged, false))
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) showWindow(win)
  })

  // media:// 流式播放录制视频（kr-02 预览）；须在 app ready 前注册特权
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
    }
  ])

  app.whenReady().then(() => {
    // Windows/Linux 去掉默认应用菜单（File/Edit/View...），macOS 保留以维持系统级快捷键与 Dock 菜单
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    else disableApplicationMenuReload()
    // 仅开发期覆盖 Dock 图标；打包后 .app 自带 icns，无需也不应覆盖
    if (process.platform === 'darwin' && appIcon && !app.isPackaged) {
      app.dock?.setIcon(appIcon)
    }
    configureAboutPanel(APP_NAME, packageMetadata.version, packageMetadata.homepage)
    registerDisplayMediaHandler()
    displaySelectionOutline.initialize()
    registerMediaProtocol()
    registerIpc(() => win, appIcon)
    sessionCatalog.load()
    void sessionCatalog.purgeExpired()
    setInterval(() => void sessionCatalog.purgeExpired(), 60_000).unref()
    createWindow()
    updateService.initialize(() => win)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else if (win) showWindow(win)
    })
  })

  app.on('before-quit', () => {
    quitting = true
    displaySelectionOutline.dispose()
    disposeTray()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

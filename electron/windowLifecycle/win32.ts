import { Menu, Tray, type BrowserWindow, type NativeImage } from 'electron'

let tray: Tray | null = null

export function configureApplicationMenu(): void {
  Menu.setApplicationMenu(null)
}

export function configureAboutPanel(
  _applicationName: string,
  _applicationVersion: string,
  _website: string
): void {}

export function backgroundWindow(win: BrowserWindow, icon?: NativeImage): void {
  if (tray) {
    win.hide()
    return
  }

  // 托盘是后台窗口的唯一恢复入口；创建失败时保留窗口，避免留下无法找回的进程。
  if (!icon || icon.isEmpty()) {
    showWindow(win)
    return
  }

  let nextTray: Tray | null = null
  try {
    nextTray = new Tray(icon)
    nextTray.setToolTip('Lenza')
    nextTray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开 Lenza', click: () => showWindow(win) },
      { type: 'separator' },
      { label: '退出 Lenza', role: 'quit' }
    ]))
    nextTray.on('click', () => showWindow(win))
    tray = nextTray
    win.hide()
  } catch {
    nextTray?.destroy()
    showWindow(win)
  }
}

export function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function disposeTray(): void {
  tray?.destroy()
  tray = null
}

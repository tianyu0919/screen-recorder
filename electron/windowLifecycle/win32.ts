import { Menu, Tray, type BrowserWindow, type NativeImage } from 'electron'

let tray: Tray | null = null

export function backgroundWindow(win: BrowserWindow, icon?: NativeImage): void {
  win.hide()
  if (tray || !icon) return
  tray = new Tray(icon)
  tray.setToolTip('Lenza')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Lenza', click: () => showWindow(win) },
    { type: 'separator' },
    { label: '退出 Lenza', role: 'quit' }
  ]))
  tray.on('click', () => showWindow(win))
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

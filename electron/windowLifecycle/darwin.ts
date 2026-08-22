import { app, type BrowserWindow } from 'electron'

export function backgroundWindow(win: BrowserWindow): void {
  win.hide()
}

export function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  app.focus({ steal: true })
  win.show()
  win.focus()
}

export function disposeTray(): void {}

import type { BrowserWindow } from 'electron'

export function backgroundWindow(win: BrowserWindow): void {
  win.hide()
}

export function showWindow(win: BrowserWindow): void {
  win.show()
  win.focus()
}

export function disposeTray(): void {}

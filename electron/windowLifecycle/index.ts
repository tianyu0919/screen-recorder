import type { BrowserWindow, NativeImage } from 'electron'
import * as darwin from './darwin'
import * as win32 from './win32'

const platform = process.platform === 'win32' ? win32 : darwin

export function backgroundWindow(win: BrowserWindow, icon?: NativeImage): void {
  platform.backgroundWindow(win, icon)
}

export function showWindow(win: BrowserWindow): void {
  platform.showWindow(win)
}

export function disposeTray(): void {
  platform.disposeTray()
}

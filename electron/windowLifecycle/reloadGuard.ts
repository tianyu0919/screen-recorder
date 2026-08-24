import type { BrowserWindow } from 'electron'

function isReloadInput(input: Electron.Input): boolean {
  const key = input.key.toLowerCase()
  return key === 'f5' || ((input.meta || input.control) && key === 'r')
}

/** 阻止用户快捷键刷新 Renderer，避免录制流和写盘会话被页面卸载中断。 */
export function installReloadShortcutGuard(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (isReloadInput(input)) event.preventDefault()
  })
}

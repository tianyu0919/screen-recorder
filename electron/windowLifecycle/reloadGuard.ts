import { Menu, type BrowserWindow, type MenuItem } from 'electron'

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

function disableReloadItems(items: readonly MenuItem[]): void {
  for (const item of items) {
    if (item.role === 'reload' || item.role === 'forceReload') {
      item.enabled = false
      item.visible = false
    }
    if (item.submenu) disableReloadItems(item.submenu.items)
  }
}

/** macOS 保留原生应用菜单，但移除菜单中的普通刷新和强制刷新入口。 */
export function disableApplicationMenuReload(): void {
  const menu = Menu.getApplicationMenu()
  if (menu) disableReloadItems(menu.items)
}

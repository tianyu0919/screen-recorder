import {
  app,
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'

/** 一次性创建不含 Reload/Force Reload 的原生菜单，避免运行时修改 AppKit 菜单对象。 */
export function configureApplicationMenu(): void {
  const viewItems: MenuItemConstructorOptions[] = [
    ...(!app.isPackaged
      ? [{ role: 'toggleDevTools' as const }, { type: 'separator' as const }]
      : []),
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { label: 'View', submenu: viewItems },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] }
  ]))
}

export function configureAboutPanel(
  applicationName: string,
  applicationVersion: string,
  website: string
): void {
  app.setAboutPanelOptions({
    applicationName,
    applicationVersion,
    version: applicationVersion,
    // 正式包由 Resources/Credits.html 提供可点击链接；开发态 Electron.app 只能显示纯文本降级。
    ...(app.isPackaged ? {} : { credits: website })
  })
}

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

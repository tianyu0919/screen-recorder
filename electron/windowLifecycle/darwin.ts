import { app, type BrowserWindow } from 'electron'

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

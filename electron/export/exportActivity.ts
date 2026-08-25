import { dialog, type BrowserWindow } from 'electron'

let busy = false

export function setExportBusy(value: boolean): void { busy = value }

export function confirmQuitWithExports(window: BrowserWindow | null): boolean {
  if (!busy) return true
  const options: Electron.MessageBoxSyncOptions = {
    type: 'warning',
    title: '仍有导出任务',
    message: '后台导出尚未完成',
    detail: '现在退出会取消正在导出和等待中的任务。',
    buttons: ['继续导出', '退出并取消'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }
  return window ? dialog.showMessageBoxSync(window, options) === 1
    : dialog.showMessageBoxSync(options) === 1
}

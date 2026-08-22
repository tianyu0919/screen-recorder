import { app, shell, type BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { IPC } from '../../shared/ipc'
import type { UpdateSnapshot, UpdateStatus } from '../../shared/types'
import { appSettings } from '../store/appSettings'

const RELEASES_URL = 'https://github.com/tianyu0919/screen-recorder/releases'

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/net::|ENOTFOUND|ETIMEDOUT|ERR_INTERNET/i.test(text)) return '网络连接失败，请稍后重试'
  if (/404|latest.*yml|metadata/i.test(text)) return '当前发布缺少更新文件，请前往发布页面手动下载'
  return '更新服务暂时不可用，请稍后重试'
}

function notes(info: UpdateInfo): string | undefined {
  const raw = Array.isArray(info.releaseNotes)
    ? info.releaseNotes.map((item) => item.note).join('\n')
    : info.releaseNotes
  if (!raw) return undefined
  return raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 320) || undefined
}

class UpdateService {
  private getWindow: (() => BrowserWindow | null) | null = null
  private initialized = false
  private busy = false
  private pendingAutoCheck = false
  private recording = false
  private version: string | null = null
  private releaseUrl = RELEASES_URL
  private status: UpdateStatus = { state: 'idle' }

  initialize(getWindow: () => BrowserWindow | null): void {
    this.getWindow = getWindow
    if (this.initialized) return
    this.initialized = true
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = false
    autoUpdater.on('checking-for-update', () => this.setStatus({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => {
      this.version = info.version
      this.releaseUrl = `${RELEASES_URL}/tag/v${info.version}`
      this.setStatus({
        state: 'available', version: info.version, releaseName: info.releaseName ?? undefined,
        releaseNotes: notes(info), releaseUrl: this.releaseUrl
      })
    })
    autoUpdater.on('update-not-available', () => this.setStatus({ state: 'not-available', checkedAt: Date.now() }))
    autoUpdater.on('download-progress', (progress) => this.setStatus({
      state: 'downloading', version: this.version ?? '', percent: progress.percent,
      transferred: progress.transferred, total: progress.total
    }))
    autoUpdater.on('update-downloaded', (info) => this.setStatus({ state: 'downloaded', version: info.version }))
    autoUpdater.on('error', (error) => {
      const operation = this.status.state === 'downloading' ? 'download' : 'check'
      this.setStatus({ state: 'error', operation, message: message(error) })
      this.busy = false
    })
    if (appSettings.get().autoCheckUpdates) {
      setTimeout(() => {
        if (!appSettings.get().autoCheckUpdates) return
        if (this.recording) this.pendingAutoCheck = true
        else void this.check()
      }, 10_000).unref()
    }
  }

  snapshot(): UpdateSnapshot {
    const mac = process.platform === 'darwin'
    return {
      currentVersion: app.getVersion(), status: structuredClone(this.status), recording: this.recording,
      capabilities: mac
        ? { canDownloadInApp: false, canInstallInApp: false, reason: 'macos-unsigned' }
        : { canDownloadInApp: process.platform === 'win32', canInstallInApp: process.platform === 'win32' }
    }
  }

  async check(): Promise<UpdateSnapshot> {
    if (this.recording) { this.pendingAutoCheck = true; return this.snapshot() }
    if (this.busy) return this.snapshot()
    if (!app.isPackaged) {
      this.setStatus({ state: 'error', operation: 'check', message: '开发模式不执行更新检查，请使用打包版本验证' })
      return this.snapshot()
    }
    this.busy = true
    try { await autoUpdater.checkForUpdates() }
    catch (error) { this.setStatus({ state: 'error', operation: 'check', message: message(error) }) }
    finally { this.busy = false }
    return this.snapshot()
  }

  async download(): Promise<void> {
    const retry = this.status.state === 'error' && this.status.operation === 'download' && this.version
    if (process.platform !== 'win32' || (this.status.state !== 'available' && !retry) || this.busy) return
    this.busy = true
    try { await autoUpdater.downloadUpdate() }
    catch (error) {
      this.setStatus({
        state: 'error', operation: 'download', message: message(error),
        version: this.version ?? undefined, releaseUrl: this.releaseUrl
      })
    }
    finally { this.busy = false }
  }

  install(): void {
    if (process.platform !== 'win32' || this.recording || this.status.state !== 'downloaded') return
    autoUpdater.quitAndInstall(false, true)
  }

  async openRelease(): Promise<void> { await shell.openExternal(this.releaseUrl) }

  setRecording(recording: boolean): void {
    this.recording = recording
    this.emit()
    if (!recording && this.pendingAutoCheck) { this.pendingAutoCheck = false; void this.check() }
  }

  private setStatus(status: UpdateStatus): void { this.status = status; this.emit() }
  private emit(): void { this.getWindow?.()?.webContents.send(IPC.UpdateStatusChanged, this.snapshot()) }
}

export const updateService = new UpdateService()

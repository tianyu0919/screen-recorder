import { desktopCapturer, screen, type BrowserWindow, type Display } from 'electron'
import { createDisplaySelectionOutline as createDarwinOutline } from './darwin'
import { createDisplaySelectionOutline as createWin32Outline } from './win32'

const COMPOSITOR_SETTLE_MS = 80

class DisplaySelectionOutline {
  private win: BrowserWindow | null = null
  private displayId: number | null = null
  private requestVersion = 0
  private initialized = false

  initialize(): void {
    if (this.initialized) return
    this.initialized = true
    screen.on('display-removed', this.onDisplayRemoved)
    screen.on('display-metrics-changed', this.onDisplayMetricsChanged)
  }

  async showForSource(sourceId: string): Promise<boolean> {
    const version = ++this.requestVersion
    if (!sourceId.startsWith('screen:')) {
      this.destroyCurrent()
      return false
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 }
    })
    if (version !== this.requestVersion) return false

    const source = sources.find((item) => item.id === sourceId)
    const display = screen
      .getAllDisplays()
      .find((item) => source !== undefined && String(item.id) === source.display_id)
    if (!display) {
      this.destroyCurrent()
      return false
    }

    if (this.win && !this.win.isDestroyed() && this.displayId === display.id) {
      this.win.setBounds(display.bounds)
      return true
    }

    this.destroyCurrent()
    const win = await this.createPlatformWindow(display)
    if (version !== this.requestVersion) {
      if (!win.isDestroyed()) win.destroy()
      return false
    }
    this.win = win
    this.displayId = display.id
    win.once('closed', () => {
      if (this.win === win) {
        this.win = null
        this.displayId = null
      }
    })
    return true
  }

  async hide(): Promise<void> {
    ++this.requestVersion
    const wasVisible = this.win !== null && !this.win.isDestroyed()
    this.destroyCurrent()
    // 已建立的预览流可能仍缓存覆盖层帧，等待合成器刷新后再允许 MediaRecorder 启动。
    if (wasVisible) await new Promise((resolve) => setTimeout(resolve, COMPOSITOR_SETTLE_MS))
  }

  dispose(): void {
    if (this.initialized) {
      screen.removeListener('display-removed', this.onDisplayRemoved)
      screen.removeListener('display-metrics-changed', this.onDisplayMetricsChanged)
      this.initialized = false
    }
    ++this.requestVersion
    this.destroyCurrent()
  }

  private createPlatformWindow(display: Display): Promise<BrowserWindow> {
    if (process.platform === 'darwin') return createDarwinOutline(display)
    if (process.platform === 'win32') return createWin32Outline(display)
    return Promise.reject(new Error(`Unsupported outline platform: ${process.platform}`))
  }

  private destroyCurrent(): void {
    const win = this.win
    this.win = null
    this.displayId = null
    if (win && !win.isDestroyed()) win.destroy()
  }

  private readonly onDisplayRemoved = (_event: Electron.Event, display: Display): void => {
    if (display.id === this.displayId) void this.hide()
  }

  private readonly onDisplayMetricsChanged = (_event: Electron.Event, display: Display): void => {
    if (display.id === this.displayId && this.win && !this.win.isDestroyed()) {
      this.win.setBounds(display.bounds)
    }
  }
}

export const displaySelectionOutline = new DisplaySelectionOutline()

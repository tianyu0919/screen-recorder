import { desktopCapturer, session } from 'electron'
import type { CaptureSource } from '../../shared/types'

/** 枚举 screen/window 采集源（Task 2.1） */
export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: false
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    // id 形如 "screen:0:0" / "window:123:0"
    type: s.id.startsWith('screen') ? 'screen' : 'window'
  }))
}

/**
 * ScreenCaptureKit 采集路径（bug 修复：替代 legacy chromeMediaSource getUserMedia）。
 * Renderer 调 getDisplayMedia 前先把选中的 sourceId 通过 IPC 告知 Main（prepareCaptureSource），
 * handler 据此直接 approve 该源，不弹系统选择器（useSystemPicker: false）。
 * 背景：macOS 15 上 legacy 窗口采集在窗口缩放/遮挡时帧更新不可靠（画面停滞/错位），
 * SCK 路径已实测在整屏/窗口、遮挡、多屏场景下帧均持续更新。
 */
let pendingSourceId: string | null = null

export function setPendingCaptureSource(sourceId: string): void {
  pendingSourceId = sourceId
}

export function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          const picked = sources.find((s) => s.id === pendingSourceId)
          if (picked) {
            // audio: 'loopback' 请求系统音频回采（macOS 13+ SCK / Windows 回环），
            // 不支持的平台静默无音轨，由 Renderer 检测 getAudioTracks()
            callback({ video: picked, audio: 'loopback' })
          } else {
            // 源已失效（窗口已关闭等）：拒绝本次请求，Renderer 侧按采集失败处理
            callback({})
          }
        })
        .catch(() => callback({}))
    },
    { useSystemPicker: false }
  )
}

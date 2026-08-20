import { startSystemAudioCapture as startDarwin, type StopSystemAudio } from './darwin'
import { startSystemAudioCapture as startWin32 } from './win32'

export type { StopSystemAudio }

/**
 * 系统音频采集平台分发（kr-01 system-audio）：
 * - darwin：Main 进程 spawn 原生 helper（./darwin.ts，Swift + ScreenCaptureKit）
 * - win32：Main 进程 spawn 原生 helper（./win32.ts，Rust + WASAPI loopback）——
 *   Chromium getDisplayMedia loopback + MediaRecorder 路径有杂音，已弃用
 * - 其他平台：暂不支持，静默降级（Renderer 侧 loopback 兜底，见 src/recorder/screenRecorder.ts）
 * 注：darwin.ts / win32.ts 无平台相关顶层副作用，静态引入在另一平台下同样安全。
 */
export function startSystemAudioCapture(wavPath: string): StopSystemAudio | null {
  if (process.platform === 'darwin') return startDarwin(wavPath)
  if (process.platform === 'win32') return startWin32(wavPath)
  return null
}
